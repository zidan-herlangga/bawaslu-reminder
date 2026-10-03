import { Redirect, Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { Ikon } from '../../komponen/Ikon';
import { useSesi } from '../../lib/session';

// Tab bawah.
//
// Tonggak tinggi tab adalah 49pt; di sini dipakai lebih tinggi supaya jari
// tidak terasa sempit di layar kecil. Label selalu terlihat: ikon saja tidak
// bisa dibaca staf yang baru pertama kali memakai aplikasi.

export default function LayoutTab() {
  const { session, loading } = useSesi();

  if (!loading && !session) {
    return <Redirect href="/masuk" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#0071e3',
        tabBarInactiveTintColor: '#6b6b70',
        tabBarStyle: {
          borderTopWidth: 1,
          // Dipakai safe area supaya tab tidak tertutup home indicator di iPhone.
          height: Platform.OS === 'ios' ? 88 : 64,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Beranda',
          tabBarIcon: ({ color, size }) => (
            <IkonBar nama="home-outline" warna={color} ukuran={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="kalender"
        options={{
          title: 'Agenda',
          tabBarIcon: ({ color, size }) => (
            <IkonBar nama="calendar-outline" warna={color} ukuran={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="todo"
        options={{
          title: 'Tugas',
          tabBarIcon: ({ color, size }) => (
            <IkonBar nama="checkbox-outline" warna={color} ukuran={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="akun"
        options={{
          title: 'Akun',
          tabBarIcon: ({ color, size }) => (
            <IkonBar nama="person-outline" warna={color} ukuran={size} />
          ),
        }}
      />
    </Tabs>
  );
}

// Tab icon menerima warna dari Tabs, jadi warnanya dipakai langsung, bukan
// lewat token tema: tab sudah menentukan sendiri warnanya, termasuk mode
// tidak aktif. Ikon komponen tidak cocok di sini.
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import type { ColorValue } from 'react-native';

function IkonBar({
  nama,
  warna,
  ukuran,
}: {
  nama: ComponentProps<typeof Ionicons>['name'];
  warna: ColorValue;
  ukuran: number;
}) {
  return <Ionicons name={nama} size={ukuran} color={warna} />;
}
