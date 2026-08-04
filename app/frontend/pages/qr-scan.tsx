/**
 * GreenGuard — QR Scanner Screen (Modal) — Enhanced
 *
 * Features:
 * - Flash toggle
 * - Camera flip (front/back)
 * - Animated scan frame
 * - Vibration on detection
 * - Success animation + info modal
 * - Cancel / Claim Points buttons
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Dimensions,
  Platform,
  Vibration,
  Modal,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  withRepeat,
  withTiming,
  withSpring,
  withSequence,
  useAnimatedStyle,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { Spacing, FontSize, FontWeight, Radius, Shadows } from '@/theme';

// ─── Platform-safe camera ──────────────────────────────────────────────────────
let CameraView: any = View;
let useCameraPermissions: any = () => [null, () => {}];

if (Platform.OS !== 'web') {
  const ExpoCamera = require('expo-camera');
  CameraView = ExpoCamera.CameraView;
  useCameraPermissions = ExpoCamera.useCameraPermissions;
}

// ─── Types ─────────────────────────────────────────────────────────────────────
import { parseQrPayload, scanService } from '@/services/scan.service';
import { useInvalidateUserData } from '@/hooks/useApi';
import { useUserStore } from '@/store/userStore';
import { getApiErrorMessage } from '@/utils/mappers';
import { useTheme } from '@/hooks/useTheme';
import { useI18n } from '@/hooks/useI18n';

interface ScanPreview {
  claimToken: string;
  totalItems: number;
  totalPoints: number;
  items: Array<{ itemType: string; quantity: number }>;
  expiresAt: string;
  rawQr: string;
}

// ─── Mock scan response ────────────────────────────────────────────────────────

const { width: W } = Dimensions.get('window');
const QR_SIZE = W * 0.65;

// ─── Scan Line ─────────────────────────────────────────────────────────────────
function ScanLine({ active, colors }: { active: boolean; colors: any }) {
  const translateY = useSharedValue(0);

  useEffect(() => {
    if (!active) return;
    translateY.value = 0;
    translateY.value = withRepeat(
      withTiming(QR_SIZE - 4, { duration: 1800, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [active, translateY]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: active ? 1 : 0,
  }));

  return <Animated.View style={[styles.scanLine, { backgroundColor: colors.primaryLight }, style]} />;
}

// ─── QR Frame ──────────────────────────────────────────────────────────────────
function QRFrame({ success, colors }: { success: boolean; colors: any }) {
  const scale = useSharedValue(1);
  const borderOpacity = useSharedValue(1);

  useEffect(() => {
    if (success) {
      scale.value = withSequence(
        withSpring(1.05, { damping: 8 }),
        withSpring(1, { damping: 8 }),
      );
      borderOpacity.value = withRepeat(
        withSequence(withTiming(0.4, { duration: 200 }), withTiming(1, { duration: 200 })),
        3,
        false,
      );
    }
  }, [success, scale, borderOpacity]);

  const frameStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    borderColor: success ? colors.accent : colors.primaryLight,
  }));

  return (
    <Animated.View style={[styles.qrFrame, frameStyle]}>
      <View style={[styles.corner, styles.cornerTL, { borderColor: colors.primaryLight }, success && { borderColor: colors.accent }]} />
      <View style={[styles.corner, styles.cornerTR, { borderColor: colors.primaryLight }, success && { borderColor: colors.accent }]} />
      <View style={[styles.corner, styles.cornerBL, { borderColor: colors.primaryLight }, success && { borderColor: colors.accent }]} />
      <View style={[styles.corner, styles.cornerBR, { borderColor: colors.primaryLight }, success && { borderColor: colors.accent }]} />
      <ScanLine active={!success} colors={colors} />
    </Animated.View>
  );
}

// ─── Success Animation ─────────────────────────────────────────────────────────
function SuccessCheckmark({ colors }: { colors: any }) {
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    scale.value = withSpring(1, { damping: 8, stiffness: 200 });
    opacity.value = withTiming(1, { duration: 300 });
  }, [scale, opacity]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.successCircle, { backgroundColor: colors.primary }, style]}>
      <Ionicons name="checkmark" size={48} color={colors.textWhite} />
    </Animated.View>
  );
}

// ─── Claim Modal ───────────────────────────────────────────────────────────────
interface ClaimModalProps {
  result: ScanPreview | null;
  visible: boolean;
  onCancel: () => void;
  onClaim: () => void;
  isClaiming: boolean;
  colors: any;
  t: any;
}

const ClaimModal = ({ result, visible, onCancel, onClaim, isClaiming, colors, t }: ClaimModalProps) => {
  if (!result) return null;
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <View style={styles.claimBackdrop}>
        <View style={[styles.claimSheet, { backgroundColor: colors.backgroundWhite }]}>
          <View style={[styles.claimHandle, { backgroundColor: colors.borderMuted }]} />

          <View style={[styles.claimSuccessHeader, { borderBottomColor: colors.divider }]}>
            <SuccessCheckmark colors={colors} />
            <Text style={[styles.claimTitle, { color: colors.textPrimary }]}>{t('scan.readyToClaim', 'Ready to Claim!')}</Text>
            <Text style={[styles.claimSubtitle, { color: colors.textMuted }]}>{t('scan.claimSubtitle', 'Scan verified — review your session below')}</Text>
          </View>

          <View style={styles.claimBody}>
            {/* Recycle Types */}
            <View style={styles.claimRow}>
              <View style={[styles.claimIconBox, { backgroundColor: colors.backgroundCard }]}>
                <Ionicons name="leaf-outline" size={18} color={colors.primary} />
              </View>
              <View style={styles.claimRowText}>
                <Text style={[styles.claimLabel, { color: colors.textMuted }]}>{t('scan.itemsRecycled', 'Items Recycled')}</Text>
                {result.items.map((item, i) => (
                  <Text key={i} style={[styles.claimValue, { color: colors.textPrimary }]}>
                    • {item.itemType === 'plastic_bottle' ? t('scan.plasticBottle', 'Plastic Bottle') : item.itemType === 'can' ? t('scan.aluminumCan', 'Aluminum Can') : item.itemType} ×{item.quantity}
                  </Text>
                ))}
              </View>
            </View>

            {/* Points */}
            <View style={[styles.pointsHighlight, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]}>
              <Text style={[styles.pointsHighlightLabel, { color: colors.textMuted }]}>{t('scan.totalPoints', 'Total Points')}</Text>
              <View style={styles.pointsHighlightValue}>
                <Text style={styles.pointsEmoji}>🍃</Text>
                <Text style={[styles.pointsNumber, { color: colors.primary }]}>+{result.totalPoints}</Text>
                <Text style={[styles.pointsUnit, { color: colors.primary }]}>{t('common.pts', 'pts')}</Text>
              </View>
            </View>
          </View>

          <View style={styles.claimActions}>
            <Button
              label={t('common.cancel', 'Cancel')}
              variant="secondary"
              fullWidth={false}
              style={styles.claimBtn}
              onPress={onCancel}
              disabled={isClaiming}
            />
            <Button
              label={isClaiming ? t('scan.claiming', 'Claiming...') : t('scan.claimPoints', 'Claim Points')}
              variant="primary"
              fullWidth={false}
              style={styles.claimBtn}
              onPress={onClaim}
              loading={isClaiming}
              leftIcon={!isClaiming ? <Ionicons name="gift" size={16} color={colors.textWhite} /> : undefined}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
};

// ─── Import Button component ───────────────────────────────────────────────────
import { Button } from '@/components/common/Button';

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function QRScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [scanSuccess, setScanSuccess] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [scanResult, setScanResult] = useState<ScanPreview | null>(null);
  const hasScanned = useRef(false);
  const invalidateUserData = useInvalidateUserData();
  const refreshProfile = useUserStore((s) => s.refreshProfile);
  const { colors } = useTheme();
  const { t } = useI18n();

  useEffect(() => {
    if (!permission?.granted) requestPermission();
  }, [permission, requestPermission]);

  const handleBarcodeScanned = useCallback(({ data }: { data: string }) => {
    if (hasScanned.current || isProcessing) return;
    hasScanned.current = true;
    setIsProcessing(true);
    setScanSuccess(true);

    // Vibrate on scan
    if (Platform.OS !== 'web') {
      Vibration.vibrate([0, 80, 60, 80]);
    }

    // Parse the signed QR payload JSON
    const payload = parseQrPayload(data);
    if (!payload) {
      Alert.alert(t('scan.invalidQrTitle', 'Invalid QR Code'), t('scan.invalidQrDesc', 'This QR code is not from a GreenGuard machine.'));
      hasScanned.current = false;
      setIsProcessing(false);
      setScanSuccess(false);
      return;
    }

    // Check expiry client-side for instant feedback
    if (new Date(payload.expiresAt) < new Date()) {
      Alert.alert(t('scan.expiredTitle', 'Expired'), t('scan.expiredDesc', 'This QR code has expired. Please recycle again to get a new one.'));
      hasScanned.current = false;
      setIsProcessing(false);
      setScanSuccess(false);
      return;
    }

    setScanResult({
      claimToken: payload.claimToken,
      totalItems: payload.totalItems,
      totalPoints: payload.totalPoints,
      items: payload.items,
      expiresAt: payload.expiresAt,
      rawQr: payload.raw || data.trim(),
    });
    setModalVisible(true);
    setIsProcessing(false);
  }, [isProcessing, t]);

  const handleCancel = () => {
    setModalVisible(false);
    setScanSuccess(false);
    setScanResult(null);
    hasScanned.current = false;
  };

  const handleClaim = async () => {
    setIsClaiming(true);
    try {
      const result = await scanService.claimContribution(
        scanResult!.claimToken,
        scanResult!.rawQr,
      );
      const currentUser = useUserStore.getState().user;
      if (currentUser) {
        useUserStore.getState().setUser({
          ...currentUser,
          totalPoints: result.totalBalance,
        });
      }
      await refreshProfile();
      invalidateUserData();
      setIsClaiming(false);
      setModalVisible(false);
      Alert.alert(
        t('scan.pointsClaimedTitle', 'Points Claimed!'),
        `+${result.pointsEarned} pts · Balance: ${result.totalBalance}`,
        [{ text: t('common.ok', 'OK'), onPress: () => router.back() }],
      );
    } catch (error: any) {
      setIsClaiming(false);
      const status = error?.response?.status;
      const message = getApiErrorMessage(error, t('scan.defaultError', 'Something went wrong. Please try again.'));

      if (status === 409) {
        Alert.alert(t('scan.alreadyClaimedTitle', 'Already Claimed'), message);
      } else if (status === 410) {
        Alert.alert(t('scan.expiredTitle', 'Expired'), message);
      } else if (status === 404) {
        Alert.alert(t('scan.notFoundTitle', 'Not Found'), t('scan.notFoundDesc', 'Session not found. Please try again in a moment.'));
      } else {
        Alert.alert(t('common.error', 'Error'), message);
      }
      handleCancel();
    }
  };

  // ── Permission loading
  if (!permission) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} style={{ flex: 1 }} />
      </View>
    );
  }

  // ── Permission denied
  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <TouchableOpacity style={styles.topBackBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.textWhite} />
          <Text style={[styles.backLabel, { color: colors.textWhite }]}>{t('common.back', 'Back')}</Text>
        </TouchableOpacity>
        <View style={styles.permissionContainer}>
          <View style={[styles.permissionIcon, { backgroundColor: colors.successLight }]}>
            <Ionicons name="camera-outline" size={52} color={colors.primary} />
          </View>
          <Text style={[styles.permissionTitle, { color: colors.textWhite }]}>{t('scan.cameraRequired', 'Camera Access Required')}</Text>
          <Text style={styles.permissionDesc}>
            {t('scan.cameraDesc', 'GreenGuard needs camera access to scan QR codes at recycling points and earn your reward points.')}
          </Text>
          <TouchableOpacity style={[styles.grantBtn, { backgroundColor: colors.primary }]} onPress={requestPermission}>
            <Text style={[styles.grantBtnText, { color: colors.textWhite }]}>{t('scan.grantCamera', 'Grant Camera Permission')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Web fallback
  if (Platform.OS === 'web') {
    return (
      <SafeAreaView style={styles.container}>
        <TouchableOpacity style={styles.topBackBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.textWhite} />
          <Text style={[styles.backLabel, { color: colors.textWhite }]}>{t('common.back', 'Back')}</Text>
        </TouchableOpacity>
        <View style={styles.permissionContainer}>
          <View style={[styles.permissionIcon, { backgroundColor: colors.successLight }]}>
            <Ionicons name="qr-code-outline" size={52} color={colors.primary} />
          </View>
          <Text style={[styles.permissionTitle, { color: colors.textWhite }]}>{t('scan.cameraNotAvailable', 'Camera Not Available')}</Text>
          <Text style={styles.permissionDesc}>
            {t('scan.cameraWebDesc', 'QR scanning is available on Android and iOS devices.\nPlease use the mobile app to scan QR codes.')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      {/* Camera */}
      <CameraView
        style={StyleSheet.absoluteFill}
        facing={facing}
        enableTorch={flashEnabled}
        onBarcodeScanned={!hasScanned.current ? handleBarcodeScanned : undefined}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
      />

      {/* Dark overlay with hole */}
      <View style={styles.overlay}>
        <View style={styles.overlayTop} />
        <View style={styles.overlayMiddle}>
          <View style={styles.overlaySide} />
          <QRFrame success={scanSuccess} colors={colors} />
          <View style={styles.overlaySide} />
        </View>
        <View style={styles.overlayBottom} />
      </View>

      {/* Instruction text */}
      {!scanSuccess && (
        <View style={styles.instructionBox}>
          <Text style={styles.instructionText}>{t('scan.instruction', 'Point camera at the QR code on the machine')}</Text>
        </View>
      )}

      {/* Processing indicator */}
      {isProcessing && !modalVisible && (
        <View style={styles.processingBox}>
          <ActivityIndicator size="small" color={colors.textWhite} />
          <Text style={[styles.processingText, { color: colors.textWhite }]}>{t('scan.verifying', 'Verifying QR code...')}</Text>
        </View>
      )}

      {/* Header */}
      <SafeAreaView style={styles.headerSafe} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color={colors.textWhite} />
            <Text style={[styles.backLabel, { color: colors.textWhite }]}>{t('common.back', 'Back')}</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.textWhite }]}>{t('scan.title', 'Scan QR Code')}</Text>
          {/* Flash toggle */}
          <TouchableOpacity
            style={[styles.headerIconBtn, flashEnabled && styles.headerIconBtnActive]}
            onPress={() => setFlashEnabled((v) => !v)}
          >
            <Ionicons
              name={flashEnabled ? 'flash' : 'flash-outline'}
              size={22}
              color={flashEnabled ? colors.accent : colors.textWhite}
            />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* Bottom bar */}
      <SafeAreaView style={styles.bottomSafe} edges={['bottom']}>
        <View style={styles.bottomBar}>
          {/* Camera flip */}
          <TouchableOpacity
            style={styles.bottomAction}
            onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}
          >
            <Ionicons name="camera-reverse-outline" size={26} color={colors.textWhite} />
            <Text style={styles.bottomActionLabel}>{t('scan.flip', 'Flip')}</Text>
          </TouchableOpacity>

          {/* Center QR icon */}
          <View style={[styles.centerQR, { backgroundColor: colors.primary }]}>
            <Ionicons name="qr-code-outline" size={30} color={colors.textWhite} />
          </View>

          {/* History */}
          <TouchableOpacity style={styles.bottomAction} onPress={() => router.push('/history' as any)}>
            <Ionicons name="time-outline" size={26} color={colors.textWhite} />
            <Text style={styles.bottomActionLabel}>{t('scan.history', 'History')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* Claim Modal */}
      <ClaimModal
        result={scanResult}
        visible={modalVisible}
        onCancel={handleCancel}
        onClaim={handleClaim}
        isClaiming={isClaiming}
        colors={colors}
        t={t}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const CORNER_SIZE = 26;
const CORNER_THICKNESS = 3;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A1F0A' },

  // Header
  headerSafe: { position: 'absolute', top: 0, left: 0, right: 0 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
  },
  headerBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  headerTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semiBold,
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconBtnActive: { backgroundColor: 'rgba(137,197,65,0.25)' },
  backLabel: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.medium,
  },
  topBackBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, padding: Spacing.base },

  // Overlay
  overlay: { ...StyleSheet.absoluteFillObject, flexDirection: 'column' },
  overlayTop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.68)' },
  overlayMiddle: { flexDirection: 'row', height: QR_SIZE },
  overlaySide: { flex: 1, backgroundColor: 'rgba(0,0,0,0.68)' },
  overlayBottom: { flex: 1.3, backgroundColor: 'rgba(0,0,0,0.68)' },

  // QR Frame
  qrFrame: {
    width: QR_SIZE,
    height: QR_SIZE,
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1.5,
    borderRadius: Radius.sm,
  },
  corner: {
    position: 'absolute',
    width: CORNER_SIZE,
    height: CORNER_SIZE,
  },
  cornerTL: { top: -1, left: -1, borderTopWidth: CORNER_THICKNESS, borderLeftWidth: CORNER_THICKNESS },
  cornerTR: { top: -1, right: -1, borderTopWidth: CORNER_THICKNESS, borderRightWidth: CORNER_THICKNESS },
  cornerBL: { bottom: -1, left: -1, borderBottomWidth: CORNER_THICKNESS, borderLeftWidth: CORNER_THICKNESS },
  cornerBR: { bottom: -1, right: -1, borderBottomWidth: CORNER_THICKNESS, borderRightWidth: CORNER_THICKNESS },
  scanLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    opacity: 0.9,
  },

  // Instruction
  instructionBox: {
    position: 'absolute',
    bottom: '30%',
    left: Spacing.xl,
    right: Spacing.xl,
    alignItems: 'center',
  },
  instructionText: {
    fontSize: FontSize.base,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    overflow: 'hidden',
  },

  // Processing
  processingBox: {
    position: 'absolute',
    bottom: '25%',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: 'rgba(21,107,47,0.9)',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
  },
  processingText: { fontSize: FontSize.base, fontWeight: FontWeight.medium },

  // Bottom bar
  bottomSafe: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,15,0,0.85)' },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: Spacing.base,
    paddingHorizontal: Spacing['2xl'],
  },
  bottomAction: { alignItems: 'center', gap: 4, width: 60 },
  bottomActionLabel: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.7)', fontWeight: FontWeight.medium },
  centerQR: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.lg,
  },

  // Permission
  permissionContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing['2xl'],
  },
  permissionIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
  },
  permissionTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  permissionDesc: {
    fontSize: FontSize.base,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.xl,
  },
  grantBtn: {
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
  },
  grantBtnText: { fontSize: FontSize.base, fontWeight: FontWeight.semiBold },

  // Success circle
  successCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
    ...Shadows.lg,
  },

  // Claim Modal
  claimBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  claimSheet: {
    borderTopLeftRadius: Radius.modal,
    borderTopRightRadius: Radius.modal,
    paddingBottom: Spacing['2xl'],
    ...Shadows.modal,
  },
  claimHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: Spacing.md,
  },
  claimSuccessHeader: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    borderBottomWidth: 1,
  },
  claimTitle: { fontSize: FontSize['2xl'], fontWeight: FontWeight.bold },
  claimSubtitle: { fontSize: FontSize.base, marginTop: Spacing.xs },
  claimBody: { paddingHorizontal: Spacing.base, paddingTop: Spacing.base },
  claimRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  claimIconBox: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  claimRowText: { flex: 1 },
  claimLabel: { fontSize: FontSize.sm, marginBottom: 2 },
  claimValue: { fontSize: FontSize.base, fontWeight: FontWeight.medium, lineHeight: 20 },
  pointsHighlight: {
    borderRadius: Radius.lg,
    padding: Spacing.base,
    alignItems: 'center',
    marginBottom: Spacing.base,
    borderWidth: 1,
  },
  pointsHighlightLabel: { fontSize: FontSize.sm, marginBottom: Spacing.xs },
  pointsHighlightValue: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.xs },
  pointsEmoji: { fontSize: FontSize['2xl'] },
  pointsNumber: { fontSize: FontSize['6xl'], fontWeight: FontWeight.bold },
  pointsUnit: { fontSize: FontSize.lg, fontWeight: FontWeight.medium },
  claimActions: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.base,
    gap: Spacing.md,
  },
  claimBtn: { flex: 1 },
});
