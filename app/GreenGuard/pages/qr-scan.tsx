/**
 * GreenGuard — QR Scanner Screen (Modal)
 *
 * Figma:
 * - Full dark green background
 * - "← Back" header top left
 * - Camera with QR frame overlay (animated scan line)
 * - Bottom bar: camera icon | QR icon (center, larger) | history icon
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Alert,
  Dimensions,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
let CameraView: any = View;
let useCameraPermissions: any = () => [null, () => {}];

if (Platform.OS !== 'web') {
  const ExpoCamera = require('expo-camera');
  CameraView = ExpoCamera.CameraView;
  useCameraPermissions = ExpoCamera.useCameraPermissions;
}
import Animated, {
  useSharedValue,
  withRepeat,
  withTiming,
  useAnimatedStyle,
  Easing,
} from 'react-native-reanimated';
import { Colors, Spacing, FontSize, FontWeight } from '@/theme';
import { scanService } from '@/services/scan.service';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const QR_FRAME_SIZE = SCREEN_WIDTH * 0.65;

function ScanLine() {
  const translateY = useSharedValue(0);

  useEffect(() => {
    translateY.value = withRepeat(
      withTiming(QR_FRAME_SIZE - 4, { duration: 1800, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [translateY]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={[styles.scanLine, animStyle]} />
  );
}

function QRFrame() {
  return (
    <View style={styles.qrFrame}>
      {/* Corner markers */}
      <View style={[styles.corner, styles.cornerTL]} />
      <View style={[styles.corner, styles.cornerTR]} />
      <View style={[styles.corner, styles.cornerBL]} />
      <View style={[styles.corner, styles.cornerBR]} />
      {/* Scan line animation */}
      <ScanLine />
    </View>
  );
}

export default function QRScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [isProcessing, setIsProcessing] = useState(false);
  const hasScanned = useRef(false);

  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    if (hasScanned.current || isProcessing) return;
    hasScanned.current = true;
    setIsProcessing(true);

    try {
      const result = await scanService.processQRCode(data);
      Alert.alert(
        '🎉 Success!',
        `${result.message}\n\nCollection Point: ${result.collectionPointName}`,
        [{ text: 'OK', onPress: () => router.back() }],
      );
    } catch {
      Alert.alert('Error', 'Could not process QR code. Please try again.', [
        {
          text: 'Retry',
          onPress: () => {
            hasScanned.current = false;
            setIsProcessing(false);
          },
        },
        { text: 'Back', onPress: () => router.back() },
      ]);
    }
  };

  if (!permission) {
    return (
      <View style={styles.container}>
        <Text style={styles.permissionText}>Requesting camera permission...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.textWhite} />
          <Text style={styles.backLabel}>Back</Text>
        </TouchableOpacity>
        <View style={styles.permissionContainer}>
          <Ionicons name="camera-outline" size={64} color={Colors.accentSoft} />
          <Text style={styles.permissionTitle}>Camera Access Required</Text>
          <Text style={styles.permissionText}>
            GreenGuard needs camera access to scan QR codes at recycling points.
          </Text>
          <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
            <Text style={styles.permissionButtonLabel}>Grant Permission</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      {/* Camera view */}
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        onBarcodeScanned={isProcessing ? undefined : handleBarcodeScanned}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
      />

      {/* Dark overlay with transparent center hole effect */}
      <View style={styles.overlay}>
        {/* Top dark area */}
        <View style={styles.overlayTop} />

        {/* Middle row: side darks + transparent QR hole */}
        <View style={styles.overlayMiddle}>
          <View style={styles.overlaySide} />
          <QRFrame />
          <View style={styles.overlaySide} />
        </View>

        {/* Bottom dark area */}
        <View style={styles.overlayBottom} />
      </View>

      {/* Header */}
      <SafeAreaView style={styles.headerSafe} edges={['top']}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={22} color={Colors.textWhite} />
          <Text style={styles.backLabel}>Back</Text>
        </TouchableOpacity>
      </SafeAreaView>

      {/* Processing indicator */}
      {isProcessing && (
        <View style={styles.processingOverlay}>
          <Text style={styles.processingText}>Processing...</Text>
        </View>
      )}

      {/* Bottom action bar */}
      <SafeAreaView style={styles.bottomBarSafe} edges={['bottom']}>
        <View style={styles.bottomBar}>
          <TouchableOpacity style={styles.bottomAction}>
            <Ionicons name="camera-outline" size={26} color={Colors.textWhite} />
          </TouchableOpacity>

          <View style={styles.qrIconContainer}>
            <Ionicons name="qr-code-outline" size={32} color={Colors.textWhite} />
          </View>

          <TouchableOpacity style={styles.bottomAction}>
            <Ionicons name="time-outline" size={26} color={Colors.textWhite} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const CORNER_SIZE = 24;
const CORNER_THICKNESS = 3;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundSplash,
  },

  // Header
  headerSafe: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.base,
    gap: Spacing.xs,
  },
  backLabel: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.medium,
    color: Colors.textWhite,
  },

  // Overlay
  overlay: {
    ...StyleSheet.absoluteFill,
    flexDirection: 'column',
  },
  overlayTop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  overlayMiddle: {
    flexDirection: 'row',
    height: QR_FRAME_SIZE,
  },
  overlaySide: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  overlayBottom: {
    flex: 1.2,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },

  // QR Frame
  qrFrame: {
    width: QR_FRAME_SIZE,
    height: QR_FRAME_SIZE,
    position: 'relative',
    overflow: 'hidden',
  },
  corner: {
    position: 'absolute',
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderColor: Colors.primaryLight,
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
  },
  scanLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: Colors.primaryLight,
    opacity: 0.9,
  },

  // Processing
  processingOverlay: {
    position: 'absolute',
    bottom: 160,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  processingText: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semiBold,
    color: Colors.textWhite,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
    borderRadius: 20,
    overflow: 'hidden',
  },

  // Bottom bar
  bottomBarSafe: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,20,0,0.8)',
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: Spacing.base,
    paddingHorizontal: Spacing['2xl'],
  },
  bottomAction: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Permission
  permissionContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing['3xl'],
  },
  permissionTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.textWhite,
    marginTop: Spacing.base,
    marginBottom: Spacing.sm,
  },
  permissionText: {
    fontSize: FontSize.base,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    lineHeight: 22,
  },
  permissionButton: {
    marginTop: Spacing.xl,
    backgroundColor: Colors.primary,
    borderRadius: 50,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
  },
  permissionButtonLabel: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semiBold,
    color: Colors.textWhite,
  },
});
