import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import type { ColorValue } from 'react-native';
import TabDock from '../../komponen/TabDock';
import { useSesi } from '../../lib/session';

// Navigasi tab bawah.
//
// Bilah tab dirender oleh TabDock, bukan oleh Tabs bawaan. TabDock yang
// memutuskan warna, tinggi, dan perilaku keyboard, jadi di sini cukup
// mendeklarasikan nama layar + ikonnya.
//
// Label selalu terlihat: ikon saja tidak bisa dibaca staf yang baru pertama
// kali memakai aplikasi.

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
        size={size}
        // Ionicons hanya menerima string atau OpaqueColorValue, sedangkan
        // ColorValue bisa berupa PlatformColor. Warna tab selalu hex di sini.
        color={color as string}
      />
    );
  };
}

export default function LayoutTab() {
  const { session, loading } = useSesi();

  if (!loading && !session) {
    return <Redirect href="/masuk" />;
  }

  return (
    <Tabs
      tabBar={(props) => <TabDock {...props} />}
      screenOptions={{
        headerShown: false,
        // Layar tab yang tidak sedang difokus tetap ter-mount (state-nya
        // tersimpan), tapi berhenti di-render. Beranda dan Agenda sama-sama
        // melanggan realtime + polling 30-an, jadi ini memotong kerja JS
        // yang sia-sia saat tab tidak terlihat.
        freezeOnBlur: true,
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