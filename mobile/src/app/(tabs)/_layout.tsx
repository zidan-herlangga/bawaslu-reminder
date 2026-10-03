import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import type { ColorValue } from 'react-native';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSesi } from '../../lib/session';

// Tab bawah.
//
// Tinggi tab = tinggi dasar + inset bawah perangkat (home indicator iPhone,
// atau tombol Back/Home/Recent dan gesture bar di Android), sehingga tab
// tidak pernah mepet atau tertutup navigasi sistem.
// Label selalu terlihat: ikon saja tidak bisa dibaca staf yang baru pertama
// kali memakai aplikasi.

const WARNA_AKTIF = '#0071e3';
const WARNA_NONAKTIF = '#8e8e93';
const TINGGI_DASAR = 58;

type NamaIkon = ComponentProps<typeof Ionicons>['name'];

function ikonTab(aktif: NamaIkon, nonaktif: NamaIkon) {
  // color harus ColorValue, bukan string. React Navigation mengirim warna
  // yang sudah diproses, dan kalau anotasinya lebih sempit dari yang
  // diharapkan, fungsi ini tidak bisa dipakai sebagai tabBarIcon.
  return function IkonTab({
    color,
    size,
    focused,
  }: {
    color: ColorValue;
    size: number;
    focused: boolean;
  }) {
    return (
      <Ionicons
        name={focused ? aktif : nonaktif}
        size={size + 1}
        // Ionicons hanya menerima string atau OpaqueColorValue, sedangkan
        // ColorValue bisa berupa PlatformColor. Warna tab selalu hex di sini.
        color={color as string}
      />
    );
  };
}

export default function LayoutTab() {
  const { session, loading } = useSesi();
  const insets = useSafeAreaInsets();

  if (!loading && !session) {
    return <Redirect href="/masuk" />;
  }

  // Minimal 10pt jarak bawah di Android walau inset 0 (mis. perangkat tertentu
  // yang melaporkan inset kosong), supaya tab tidak menempel ke tepi layar.
  const jarakBawah = Math.max(insets.bottom, Platform.OS === 'android' ? 10 : 0);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: WARNA_AKTIF,
        tabBarInactiveTintColor: WARNA_NONAKTIF,
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopWidth: 0,
          height: TINGGI_DASAR + jarakBawah,
          paddingTop: 8,
          paddingBottom: jarakBawah + 4,
          paddingHorizontal: 8,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          // Bayangan lembut agar tab terpisah dari konten.
          elevation: 12,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -3 },
          shadowOpacity: 0.08,
          shadowRadius: 10,
        },
        tabBarItemStyle: {
          borderRadius: 14,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Beranda',
          tabBarIcon: ikonTab('home', 'home-outline'),
        }}
      />
      <Tabs.Screen
        name="kalender"
        options={{
          title: 'Agenda',
          tabBarIcon: ikonTab('calendar', 'calendar-outline'),
        }}
      />
      <Tabs.Screen
        name="todo"
        options={{
          title: 'Tugas',
          tabBarIcon: ikonTab('checkbox', 'checkbox-outline'),
        }}
      />
      <Tabs.Screen
        name="akun"
        options={{
          title: 'Akun',
          tabBarIcon: ikonTab('person', 'person-outline'),
        }}
      />
    </Tabs>
  );
}