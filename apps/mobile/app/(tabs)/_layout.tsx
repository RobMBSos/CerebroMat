import { FontAwesome } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#0f766e',
        tabBarInactiveTintColor: '#64748b',
        tabBarStyle: {
          height: 62,
          paddingTop: 8,
          paddingBottom: 8,
        },
        headerStyle: {
          backgroundColor: '#cffafe',
        },
        headerTintColor: '#0f172a',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Ejercicios',
          tabBarIcon: ({ color, size }) => <FontAwesome name="calculator" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          title: 'Progreso',
          tabBarIcon: ({ color, size }) => <FontAwesome name="line-chart" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, size }) => <FontAwesome name="user-circle" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
