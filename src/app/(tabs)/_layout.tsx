import { Tabs } from 'expo-router';
import { Home, Users, Landmark, Banknote, Menu } from 'lucide-react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { theme } from '../../ui/theme';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const bottomInset = insets.bottom;

  return (
    <Tabs screenOptions={{ 
      headerShown: false,
      tabBarActiveTintColor: theme.colors.actionPrimary,
      tabBarInactiveTintColor: theme.colors.textSecondary,
      tabBarStyle: {
        backgroundColor: theme.colors.background,
        borderTopWidth: 1,
        borderTopColor: theme.colors.borderDefault,
        height: 60 + bottomInset,
        paddingBottom: Math.max(bottomInset, 8),
        paddingTop: 6,
      },
      tabBarLabelStyle: {
        fontSize: 11,
        fontWeight: '500',
      },
    }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          // @ts-ignore
          tabBarIcon: ({ color }) => <Home color={color as string} size={24} />,
        }}
      />
      <Tabs.Screen
        name="borrowers"
        options={{
          title: 'Borrowers',
          // @ts-ignore
          tabBarIcon: ({ color }) => <Users color={color as string} size={24} />,
        }}
      />
      <Tabs.Screen
        name="loans"
        options={{
          title: 'Loans',
          // @ts-ignore
          tabBarIcon: ({ color }) => <Landmark color={color as string} size={24} />,
        }}
      />
      <Tabs.Screen
        name="collections"
        options={{
          title: 'Collections',
          // @ts-ignore
          tabBarIcon: ({ color }) => <Banknote color={color as string} size={24} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          // @ts-ignore
          tabBarIcon: ({ color }) => <Menu color={color as string} size={24} />,
        }}
      />
    </Tabs>
  );
}
