import React, { useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ImagePlus } from 'lucide-react-native';

interface Props { disabled?: boolean; onFiles: (files: File[]) => void; }

export default function VoucherFilePicker({ disabled, onFiles }: Props) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <View>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,.png,.jpg,.jpeg"
        multiple
        disabled={disabled}
        style={styles.input}
        onChange={(event) => {
          onFiles(Array.from(event.currentTarget.files || []));
          event.currentTarget.value = '';
        }}
      />
      <Pressable accessibilityRole="button" accessibilityLabel="Choose PNG or JPEG barcode images" disabled={disabled} onPress={() => input.current?.click()} style={({ pressed }) => [styles.drop, pressed && styles.pressed, disabled && styles.disabled]}>
        <View style={styles.icon}><ImagePlus size={20} color="#156B2F" /></View>
        <Text style={styles.title}>Choose barcode images</Text>
        <Text style={styles.copy}>PNG or JPEG · up to 2 MiB each · maximum 20 per batch</Text>
        <Text style={styles.cta}>Browse files</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  input: { display: 'none' } as any,
  drop: { alignItems: 'center', justifyContent: 'center', minHeight: 180, borderWidth: 1, borderStyle: 'dashed', borderColor: '#A7C89C', borderRadius: 16, backgroundColor: '#F7FAF4', padding: 20, cursor: 'pointer' as any, gap: 8 },
  pressed: { backgroundColor: '#EEF6E9' },
  disabled: { opacity: 0.55 },
  icon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E7F2DE' },
  title: { fontSize: 15, fontWeight: '700', fontFamily: 'Inter_700Bold', color: '#19331D' },
  copy: { fontSize: 12, fontFamily: 'Inter_400Regular', color: '#6B7E6A', textAlign: 'center' },
  cta: { marginTop: 3, color: '#156B2F', fontWeight: '700', fontFamily: 'Inter_700Bold', fontSize: 13 },
});
