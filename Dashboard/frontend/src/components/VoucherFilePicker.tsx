import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
interface Props { disabled?: boolean; onFiles: (files: File[]) => void; }
export default function VoucherFilePicker({ disabled }: Props) {
  return <TouchableOpacity disabled={disabled} style={{ padding: 24, borderWidth: 1, borderColor: '#D6DDD2', borderRadius: 14 }}>
    <View><Text style={{ color: '#19331D', fontWeight: '700' }}>Barcode uploads are available on the web dashboard.</Text><Text style={{ color: '#647067', marginTop: 6 }}>Open this screen in a browser to add PNG or JPEG codes.</Text></View>
  </TouchableOpacity>;
}
