import { Tabs } from 'expo-router';
import { Home, Users, Landmark, Banknote, Menu } from 'lucide-react-native';

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ 
      tabBarActiveTintColor: '#14283F',
      tabBarInactiveTintColor: '#64748B',
      headerStyle: {
        backgroundColor: '#14283F',
      },
      headerTintColor: '#FFFFFF',
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
