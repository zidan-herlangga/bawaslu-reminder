import { styled } from 'nativewind';
import { SafeAreaView } from 'react-native-safe-area-context';

// react-native-safe-area-context.SafeAreaView bukan komponen bawaan React
// Native, jadi NativeWind tidak menerapkan className padanya secara otomatis.
// Publkasikan lewat styled() supaya className (misal flex-1) ikut dipakai.
const StyledSafeAreaView = styled(SafeAreaView);

export default StyledSafeAreaView;