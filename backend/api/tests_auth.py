import io
import json
import urllib.error
from unittest.mock import patch
import pytest
from django.contrib.auth.models import User
from django.core import signing
from rest_framework.test import APIClient
from rest_framework.authtoken.models import Token
from tenants.models import Tenant, GoogleIdentity


class MockGoogleHTTPResponse:
    def __init__(self, data: dict):
        self._raw = json.dumps(data).encode('utf-8')

    def read(self):
        return self._raw

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        pass


TEST_GOOGLE_CLIENT_ID = "387140373963-eolp5877u81mtm04vmkamtpoft2dvoog.apps.googleusercontent.com"


@pytest.mark.django_db
class TestAuthenticationEndpoints:
    def setup_method(self):
        self.client = APIClient()

    def test_register_and_login_flow(self):
        # 1. Register
        reg_res = self.client.post('/api/v2/auth/register/', {
            'username': 'ramesh_finance',
            'password': 'SecurePassword123!',
            'full_name': 'Ramesh Chandra',
            'phone': '9876543210',
            'workspace_name': 'RC Finance'
        }, format='json')
        assert reg_res.status_code == 201
        assert 'token' in reg_res.data
        assert reg_res.data['user']['username'] == 'ramesh_finance'
        assert reg_res.data['tenant']['name'] == 'RC Finance'

        # 2. Login
        login_res = self.client.post('/api/v2/auth/login/', {
            'username': 'ramesh_finance',
            'password': 'SecurePassword123!'
        }, format='json')
        assert login_res.status_code == 200
        assert 'token' in login_res.data
        assert login_res.data['user']['username'] == 'ramesh_finance'
        assert login_res.data['tenant']['id'] == reg_res.data['tenant']['id']

    def test_login_invalid_credentials(self):
        res = self.client.post('/api/v2/auth/login/', {
            'username': 'nonexistent',
            'password': 'wrongpassword'
        }, format='json')
        assert res.status_code == 401
        assert res.data['error'] == 'Invalid credentials.'

    def test_google_auth_missing_configuration_returns_controlled_error(self, settings):
        settings.GOOGLE_CLIENT_ID = ''
        with patch.dict('os.environ', {'GOOGLE_CLIENT_ID': ''}):
            res = self.client.post('/api/v2/auth/google/', {
                'id_token': 'dummy_google_id_token'
            }, format='json')
            assert res.status_code == 501
            assert 'Google OAuth is not configured' in res.data['error']

    def test_google_auth_valid_id_token_new_user(self, settings):
        settings.GOOGLE_CLIENT_ID = TEST_GOOGLE_CLIENT_ID
        mock_payload = {
            "aud": TEST_GOOGLE_CLIENT_ID,
            "sub": "google-sub-new-12345",
            "email": "new.lender@example.com",
            "email_verified": True,
            "name": "New Lender"
        }
        with patch('urllib.request.urlopen', return_value=MockGoogleHTTPResponse(mock_payload)):
            res = self.client.post('/api/v2/auth/google/', {
                'id_token': 'valid_id_token'
            }, format='json')

            assert res.status_code == 200
            assert res.data['status'] == 'needs_profile'
            assert res.data['email'] == 'new.lender@example.com'
            assert res.data['profile_name'] == 'New Lender'
            assert 'temp_token' in res.data

    def test_google_auth_invalid_audience_rejected(self, settings):
        settings.GOOGLE_CLIENT_ID = TEST_GOOGLE_CLIENT_ID
        mock_payload = {
            "aud": "wrong-audience-client-id.apps.googleusercontent.com",
            "sub": "google-sub-attacker-123",
            "email": "attacker@example.com",
            "email_verified": True
        }
        with patch('urllib.request.urlopen', return_value=MockGoogleHTTPResponse(mock_payload)):
            res = self.client.post('/api/v2/auth/google/', {
                'id_token': 'token_wrong_aud'
            }, format='json')

            assert res.status_code == 400
            assert 'Token audience does not match configured Google client ID.' in res.data['error']

    def test_google_auth_expired_or_invalid_signature_rejected(self, settings):
        settings.GOOGLE_CLIENT_ID = TEST_GOOGLE_CLIENT_ID
        http_error = urllib.error.HTTPError(
            "https://oauth2.googleapis.com/tokeninfo",
            400,
            "Bad Request",
            {},
            io.BytesIO(b'{"error_description":"Invalid Value"}')
        )
        with patch('urllib.request.urlopen', side_effect=http_error):
            res = self.client.post('/api/v2/auth/google/', {
                'id_token': 'expired_or_invalid_token'
            }, format='json')

            assert res.status_code == 400
            assert 'Invalid or expired Google identity token.' in res.data['error']

    def test_google_auth_unverified_email_rejected(self, settings):
        settings.GOOGLE_CLIENT_ID = TEST_GOOGLE_CLIENT_ID
        mock_payload = {
            "aud": TEST_GOOGLE_CLIENT_ID,
            "sub": "google-sub-unverified",
            "email": "unverified@example.com",
            "email_verified": False
        }
        with patch('urllib.request.urlopen', return_value=MockGoogleHTTPResponse(mock_payload)):
            res = self.client.post('/api/v2/auth/google/', {
                'id_token': 'unverified_token'
            }, format='json')

            assert res.status_code == 400
            assert 'Google account email is not verified.' in res.data['error']

    def test_google_auth_missing_sub_claim_rejected(self, settings):
        settings.GOOGLE_CLIENT_ID = TEST_GOOGLE_CLIENT_ID
        mock_payload = {
            "aud": TEST_GOOGLE_CLIENT_ID,
            "email": "nosub@example.com",
            "email_verified": True
        }
        with patch('urllib.request.urlopen', return_value=MockGoogleHTTPResponse(mock_payload)):
            res = self.client.post('/api/v2/auth/google/', {
                'id_token': 'missing_sub_token'
            }, format='json')

            assert res.status_code == 400
            assert 'Google identity token missing subject (sub) claim.' in res.data['error']

    def test_google_complete_onboarding_creates_tenant_and_identity_without_duplicate(self):
        signer = signing.TimestampSigner(salt='google-onboarding')
        temp_data = json.dumps({
            "email": "lender.new@gmail.com",
            "name": "Lender New",
            "sub": "google-sub-unique-987"
        })
        temp_token = signer.sign(temp_data)

        res = self.client.post('/api/v2/auth/google/complete/', {
            'temp_token': temp_token,
            'phone': '9876500001',
            'full_name': 'Lender New',
            'workspace_name': 'Lender New Workspace'
        }, format='json')

        assert res.status_code == 201
        assert 'token' in res.data
        user = User.objects.get(email='lender.new@gmail.com')
        assert user.owned_tenant.name == 'Lender New Workspace'
        assert Tenant.objects.filter(owner=user).count() == 1

        # Verify GoogleIdentity record exists with immutable sub
        identity = GoogleIdentity.objects.get(user=user)
        assert identity.google_sub == "google-sub-unique-987"
        assert identity.email == "lender.new@gmail.com"

        # Calling again with same token payload / sub returns existing user/tenant without creating duplicate
        res2 = self.client.post('/api/v2/auth/google/complete/', {
            'temp_token': temp_token,
            'phone': '9876500001'
        }, format='json')
        assert res2.status_code == 200
        assert res2.data['tenant']['id'] == res.data['tenant']['id']
        assert Tenant.objects.filter(owner=user).count() == 1

    def test_account_takeover_prevention_on_matching_email(self, settings):
        settings.GOOGLE_CLIENT_ID = TEST_GOOGLE_CLIENT_ID

        # Existing password user registered with alice@example.com
        user = User.objects.create_user(
            username='alice_finance',
            email='alice@example.com',
            password='PasswordAlice123!'
        )
        Tenant.objects.create(name="Alice Workspace", owner=user)

        # Attacker / unlinked Google user tries to authenticate with matching email
        mock_payload = {
            "aud": TEST_GOOGLE_CLIENT_ID,
            "sub": "google-sub-attacker-9999",
            "email": "alice@example.com",
            "email_verified": True,
            "name": "Alice Attacker"
        }
        with patch('urllib.request.urlopen', return_value=MockGoogleHTTPResponse(mock_payload)):
            res = self.client.post('/api/v2/auth/google/', {
                'id_token': 'alice_google_token'
            }, format='json')

            # Must reject with 409 Conflict and ACCOUNT_EXISTS_LINK_REQUIRED
            assert res.status_code == 409
            assert res.data['code'] == 'ACCOUNT_EXISTS_LINK_REQUIRED'
            assert 'link your Google account' in res.data['error']

    def test_authenticated_google_linking_and_subsequent_login(self, settings):
        settings.GOOGLE_CLIENT_ID = TEST_GOOGLE_CLIENT_ID

        # 1. Existing user registered with username and password
        user = User.objects.create_user(
            username='bob_finance',
            email='bob@example.com',
            password='PasswordBob123!'
        )
        tenant = Tenant.objects.create(name="Bob Lending", owner=user)
        user_token = Token.objects.create(user=user)

        # 2. Bob links his Google account while authenticated
        link_payload = {
            "aud": TEST_GOOGLE_CLIENT_ID,
            "sub": "google-sub-bob-legit",
            "email": "bob@example.com",
            "email_verified": True,
            "name": "Bob Finance"
        }
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {user_token.key}')
        with patch('urllib.request.urlopen', return_value=MockGoogleHTTPResponse(link_payload)):
            link_res = self.client.post('/api/v2/auth/google/link/', {
                'id_token': 'bob_google_id_token'
            }, format='json')

            assert link_res.status_code == 200
            assert link_res.data['status'] == 'linked'
            assert link_res.data['google_sub'] == 'google-sub-bob-legit'

        # Check identity stored
        identity = GoogleIdentity.objects.get(user=user)
        assert identity.google_sub == 'google-sub-bob-legit'

        # 3. Subsequent Google sign-in works immediately via immutable sub
        self.client.credentials()  # Clear auth headers
        with patch('urllib.request.urlopen', return_value=MockGoogleHTTPResponse(link_payload)):
            login_res = self.client.post('/api/v2/auth/google/', {
                'id_token': 'bob_google_id_token'
            }, format='json')

            assert login_res.status_code == 200
            assert login_res.data['status'] == 'success'
            assert login_res.data['token'] == user_token.key
            assert login_res.data['tenant']['id'] == str(tenant.id)
            assert login_res.data['tenant']['name'] == 'Bob Lending'

        # 4. Username/password login remains fully functional
        pwd_login = self.client.post('/api/v2/auth/login/', {
            'username': 'bob_finance',
            'password': 'PasswordBob123!'
        }, format='json')
        assert pwd_login.status_code == 200
        assert pwd_login.data['token'] == user_token.key

    def test_google_link_conflict_with_another_user(self, settings):
        settings.GOOGLE_CLIENT_ID = TEST_GOOGLE_CLIENT_ID

        # User 1 has already linked sub 'google-sub-shared'
        user1 = User.objects.create_user(username='user_one', email='user1@example.com', password='PassUser1!')
        GoogleIdentity.objects.create(user=user1, google_sub='google-sub-shared', email='user1@example.com')

        # User 2 tries to link the same Google sub
        user2 = User.objects.create_user(username='user_two', email='user2@example.com', password='PassUser2!')
        Tenant.objects.create(name="User Two Workspace", owner=user2)
        token2 = Token.objects.create(user=user2)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token2.key}')


        mock_payload = {
            "aud": TEST_GOOGLE_CLIENT_ID,
            "sub": "google-sub-shared",
            "email": "user1@example.com",
            "email_verified": True
        }
        with patch('urllib.request.urlopen', return_value=MockGoogleHTTPResponse(mock_payload)):
            res = self.client.post('/api/v2/auth/google/link/', {
                'id_token': 'shared_google_token'
            }, format='json')

            assert res.status_code == 409
            assert 'already linked to another user' in res.data['error']

    def test_google_link_unauthenticated_rejected(self):
        res = self.client.post('/api/v2/auth/google/link/', {
            'id_token': 'dummy_token'
        }, format='json')
        assert res.status_code in (401, 403)

    def test_password_reset_zero_knowledge_neutral_privacy(self):
        # Request with registered email
        User.objects.create_user(username='existing_user', email='registered@example.com', password='password123')
        res1 = self.client.post('/api/v2/auth/password-reset/', {
            'email': 'registered@example.com'
        }, format='json')
        assert res1.status_code == 200
        assert res1.data['message'] == 'If an account matches this email, password reset instructions will be sent.'

        # Request with unregistered email returns EXACT SAME neutral confirmation
        res2 = self.client.post('/api/v2/auth/password-reset/', {
            'email': 'unregistered@example.com'
        }, format='json')
        assert res2.status_code == 200
        assert res2.data['message'] == 'If an account matches this email, password reset instructions will be sent.'
