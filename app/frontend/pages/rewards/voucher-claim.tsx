/**
 * GreenGuard — Voucher Claim Screen
 *
 * Premium voucher detail and redeem UI.
 * Accessed from Rewards screen → reward card press.
 */
import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  Dimensions,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import Animated, {
  useSharedValue,
  withSpring,
  withSequence,
  withTiming,
  useAnimatedStyle,
  withDelay,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Spacing, FontSize, FontWeight, Radius, Shadows } from '@/theme';
import { Button } from '@/components/common/Button';
import { useResponsive } from '@/hooks/useResponsive';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface VoucherDetail {
  id: string;
  brandName: string;
  brandEmoji: string;
  brandColor: string;
  title: string;
  description: string;
  pointsRequired: number;
  valueVnd: number;
  expiryDate: string;
  remainingQty: number;
  terms: string[];
  category: string;
}

// ─── Mock Data ─────────────────────────────────────────────────────────────────

const MOCK_VOUCHERS: VoucherDetail[] = [
  {
    id: 'hrwd_001',
    brandName: 'HCMUT',
    brandEmoji: '🎓',
    brandColor: '#1565C0',
    title: 'Digital Parking Ticket',
    description: 'Get one free day of parking at HCMUT campus. Valid for all parking zones. Scan QR at entry gate.',
    pointsRequired: 2000,
    valueVnd: 30000,
    expiryDate: '31 Dec 2026',
    remainingQty: 50,
    category: 'Parking',
    terms: [
      'Valid for one parking session (up to 8 hours)',
      'Valid at HCMUT campus parking only',
      'Cannot be combined with other promotions',
      'Non-transferable and non-refundable',
      'Must be presented at entry gate',
    ],
  },
  {
    id: 'hrwd_002',
    brandName: 'CocaCola',
    brandEmoji: '🥤',
    brandColor: '#E53935',
    title: 'Free Coca-Cola Promo Code',
    description: 'Redeem for a free 330ml Coca-Cola at any participating Circle K or GS25 store near HCMUT.',
    pointsRequired: 500,
    valueVnd: 15000,
    expiryDate: '30 Jun 2026',
    remainingQty: 120,
    category: 'Food & Drink',
    terms: [
      'Valid at participating Circle K and GS25 stores',
      'One voucher per customer per day',
      'Valid for 330ml Coca-Cola Original only',
      'Cannot be exchanged for cash',
      'Valid until expiry date shown',
    ],
  },
  {
    id: 'hrwd_003',
    brandName: 'AquaFina',
    brandEmoji: '💧',
    brandColor: '#1565C0',
    title: 'Free Water Bottle at Circle K',
    description: 'Get a free 500ml AquaFina water bottle at Circle K on Lý Thường Kiệt. Stay hydrated while recycling!',
    pointsRequired: 300,
    valueVnd: 10000,
    expiryDate: '31 Aug 2026',
    remainingQty: 80,
    category: 'Food & Drink',
    terms: [
      'Valid at Circle K, 268 Lý Thường Kiệt, Quận 10',
      'One voucher per purchase',
      'Valid for AquaFina 500ml only',
      'Not valid with other promotions',
    ],
  },
];

const RELATED_VOUCHERS = MOCK_VOUCHERS.slice(0, 2);

const USER_POINTS = 1250;

// ─── QR Code Preview (SVG-based mock) ─────────────────────────────────────────

const MockQRCode = ({ color }: { color: string }) => (
  <View style={[styles.qrBox, { borderColor: color }]}>
    <View style={styles.qrGrid}>
      {Array.from({ length: 7 }).map((_, row) =>
        Array.from({ length: 7 }).map((_, col) => {
          const isCorner =
            (row < 2 && col < 2) ||
            (row < 2 && col > 4) ||
            (row > 4 && col < 2);
          const isRandom = Math.random() > 0.5;
          return (
            <View
              key={`${row}-${col}`}
              style={[
                styles.qrCell,
                (isCorner || isRandom) && { backgroundColor: color },
              ]}
            />
          );
        })
      )}
    </View>
    <View style={[styles.qrCorner, styles.qrTL, { borderColor: color }]} />
    <View style={[styles.qrCorner, styles.qrTR, { borderColor: color }]} />
    <View style={[styles.qrCorner, styles.qrBL, { borderColor: color }]} />
  </View>
);

// ─── Success Animation ─────────────────────────────────────────────────────────

const SuccessOverlay = ({ onDone }: { onDone: () => void }) => {
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);
  const badgeScale = useSharedValue(0);

  React.useEffect(() => {
    opacity.value = withTiming(1, { duration: 300 });
    scale.value = withSpring(1, { damping: 8 });
    badgeScale.value = withDelay(400, withSpring(1, { damping: 6 }));

    const timer = setTimeout(onDone, 2800);
    return () => clearTimeout(timer);
  }, []);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const circleStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const badgeStyle = useAnimatedStyle(() => ({ transform: [{ scale: badgeScale.value }] }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.successOverlay, overlayStyle]}>
      <Animated.View style={[styles.successCircle, circleStyle]}>
        <Text style={styles.successEmoji}>✅</Text>
      </Animated.View>
      <Animated.View style={[styles.successBadge, badgeStyle]}>
        <Text style={styles.successTitle}>Voucher Redeemed!</Text>
        <Text style={styles.successSub}>Check your wallet for the QR code</Text>
      </Animated.View>
    </Animated.View>
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────

const { width: W } = Dimensions.get('window');

export default function VoucherClaimScreen() {
  const { isLargeScreen } = useResponsive();
  const params = useLocalSearchParams<{ id?: string }>();
  const voucherId = params.id ?? 'hrwd_001';
  const voucher = MOCK_VOUCHERS.find((v) => v.id === voucherId) ?? MOCK_VOUCHERS[0];

  const [confirmVisible, setConfirmVisible] = useState(false);
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showQR, setShowQR] = useState(false);

  const canAfford = USER_POINTS >= voucher.pointsRequired;

  const handleRedeem = async () => {
    setConfirmVisible(false);
    setIsRedeeming(true);
    await new Promise((r) => setTimeout(r, 1500));
    setIsRedeeming(false);
    setShowSuccess(true);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBack}>
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Voucher Details</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, isLargeScreen && styles.contentDesktop]}
        showsVerticalScrollIndicator={false}
      >
        {/* Banner */}
        <LinearGradient
          colors={[voucher.brandColor, voucher.brandColor + 'CC', Colors.primary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.banner}
        >
          <View style={styles.bannerOverlay}>
            <Text style={styles.bannerEmoji}>{voucher.brandEmoji}</Text>
            <View style={styles.bannerBrandTag}>
              <Text style={styles.bannerBrandText}>{voucher.brandName}</Text>
            </View>
          </View>
          <View style={styles.bannerDecor1} />
          <View style={styles.bannerDecor2} />
        </LinearGradient>

        {/* Main card */}
        <View style={styles.mainCard}>
          <View style={styles.categoryChip}>
            <Text style={styles.categoryText}>{voucher.category}</Text>
          </View>
          <Text style={styles.voucherTitle}>{voucher.title}</Text>

          {/* Points + value row */}
          <View style={styles.pointsRow}>
            <View style={styles.pointsRequired}>
              <Text style={styles.pointsRequiredLabel}>Required</Text>
              <View style={styles.pointsRequiredValue}>
                <Text style={styles.leafEmoji}>🍃</Text>
                <Text style={styles.pointsRequiredNum}>{voucher.pointsRequired.toLocaleString()}</Text>
                <Text style={styles.pointsRequiredUnit}>pts</Text>
              </View>
            </View>
            <View style={styles.pointsDivider} />
            <View style={styles.pointsValue}>
              <Text style={styles.pointsValueLabel}>Value</Text>
              <Text style={styles.pointsValueNum}>{voucher.valueVnd.toLocaleString()}đ</Text>
            </View>
            <View style={styles.pointsDivider} />
            <View style={styles.pointsBalance}>
              <Text style={styles.pointsBalanceLabel}>Your Balance</Text>
              <Text style={[styles.pointsBalanceNum, !canAfford && { color: Colors.error }]}>
                {USER_POINTS.toLocaleString()} pts
              </Text>
            </View>
          </View>

          {!canAfford && (
            <View style={styles.insufficientBanner}>
              <Ionicons name="information-circle-outline" size={16} color={Colors.error} />
              <Text style={styles.insufficientText}>
                You need {(voucher.pointsRequired - USER_POINTS).toLocaleString()} more points
              </Text>
            </View>
          )}

          {/* Description */}
          <Text style={styles.sectionLabel}>About this voucher</Text>
          <Text style={styles.description}>{voucher.description}</Text>

          {/* Meta info */}
          <View style={styles.metaGrid}>
            <View style={styles.metaItem}>
              <Ionicons name="calendar-outline" size={16} color={Colors.primary} />
              <View>
                <Text style={styles.metaLabel}>Expires</Text>
                <Text style={styles.metaValue}>{voucher.expiryDate}</Text>
              </View>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="layers-outline" size={16} color={Colors.primary} />
              <View>
                <Text style={styles.metaLabel}>Remaining</Text>
                <Text style={styles.metaValue}>{voucher.remainingQty} left</Text>
              </View>
            </View>
          </View>

          {/* Terms */}
          <Text style={styles.sectionLabel}>Terms & Conditions</Text>
          {voucher.terms.map((t, i) => (
            <View key={i} style={styles.termRow}>
              <Text style={styles.termBullet}>•</Text>
              <Text style={styles.termText}>{t}</Text>
            </View>
          ))}

          {/* Redeem button */}
          <Button
            label={isRedeeming ? 'Redeeming...' : canAfford ? 'Redeem Now' : 'Insufficient Points'}
            onPress={() => canAfford && setConfirmVisible(true)}
            loading={isRedeeming}
            disabled={!canAfford || isRedeeming}
            style={styles.redeemBtn}
            leftIcon={canAfford && !isRedeeming ? <Ionicons name="gift-outline" size={18} color={Colors.textWhite} /> : undefined}
          />
        </View>

        {/* Related vouchers */}
        <Text style={styles.relatedTitle}>You May Also Like</Text>
        <View style={styles.relatedGrid}>
          {RELATED_VOUCHERS.filter((v) => v.id !== voucher.id).slice(0, 2).map((v) => (
            <TouchableOpacity
              key={v.id}
              style={styles.relatedCard}
              onPress={() => router.setParams({ id: v.id })}
              activeOpacity={0.8}
            >
              <View style={[styles.relatedBanner, { backgroundColor: v.brandColor }]}>
                <Text style={styles.relatedEmoji}>{v.brandEmoji}</Text>
              </View>
              <View style={styles.relatedContent}>
                <Text style={styles.relatedBrand}>{v.brandName}</Text>
                <Text style={styles.relatedName} numberOfLines={2}>{v.title}</Text>
                <View style={styles.relatedPoints}>
                  <Text style={styles.relatedPointsText}>🍃 {v.pointsRequired.toLocaleString()} pts</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Confirm Modal */}
      <Modal visible={confirmVisible} transparent animationType="fade" onRequestClose={() => setConfirmVisible(false)}>
        <View style={styles.confirmBackdrop}>
          <View style={styles.confirmSheet}>
            <Text style={styles.confirmEmoji}>{voucher.brandEmoji}</Text>
            <Text style={styles.confirmTitle}>Confirm Redemption</Text>
            <Text style={styles.confirmDesc}>
              You are about to redeem{'\n'}
              <Text style={{ fontWeight: FontWeight.bold, color: Colors.textPrimary }}>{voucher.title}</Text>
            </Text>
            <View style={styles.confirmCost}>
              <Text style={styles.confirmCostLabel}>Cost</Text>
              <Text style={styles.confirmCostValue}>🍃 {voucher.pointsRequired.toLocaleString()} pts</Text>
            </View>
            <View style={styles.confirmCost}>
              <Text style={styles.confirmCostLabel}>Balance after</Text>
              <Text style={styles.confirmCostValue}>{(USER_POINTS - voucher.pointsRequired).toLocaleString()} pts</Text>
            </View>
            <View style={styles.confirmActions}>
              <Button label="Cancel" variant="secondary" fullWidth={false} style={styles.confirmBtn} onPress={() => setConfirmVisible(false)} />
              <Button label="Confirm" variant="primary" fullWidth={false} style={styles.confirmBtn} onPress={handleRedeem} />
            </View>
          </View>
        </View>
      </Modal>

      {/* QR Preview Modal */}
      <Modal visible={showQR} transparent animationType="slide" onRequestClose={() => setShowQR(false)}>
        <View style={styles.confirmBackdrop}>
          <View style={styles.qrModal}>
            <Text style={styles.qrModalTitle}>Your Voucher QR</Text>
            <Text style={styles.qrModalSub}>Show this to the staff to redeem</Text>
            <MockQRCode color={voucher.brandColor} />
            <Text style={styles.qrCode}>GP-{voucher.id.toUpperCase()}-2026</Text>
            <Button label="Close" variant="secondary" onPress={() => setShowQR(false)} style={{ marginTop: Spacing.base }} />
          </View>
        </View>
      </Modal>

      {/* Success overlay */}
      {showSuccess && (
        <SuccessOverlay
          onDone={() => {
            setShowSuccess(false);
            setShowQR(true);
          }}
        />
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.backgroundScreen },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.backgroundScreen,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  headerBack: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.semiBold, color: Colors.textPrimary },

  scroll: { flex: 1 },
  content: { paddingBottom: Spacing['2xl'] },
  contentDesktop: { paddingHorizontal: Spacing['3xl'], maxWidth: 800, alignSelf: 'center', width: '100%' },

  // Banner
  banner: {
    height: 200,
    position: 'relative',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bannerOverlay: { alignItems: 'center', zIndex: 1 },
  bannerEmoji: { fontSize: 64, marginBottom: Spacing.sm },
  bannerBrandTag: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.pill,
  },
  bannerBrandText: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textWhite },
  bannerDecor1: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.08)',
    top: -60,
    right: -60,
  },
  bannerDecor2: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(255,255,255,0.06)',
    bottom: -40,
    left: -30,
  },

  // Main card
  mainCard: {
    backgroundColor: Colors.backgroundWhite,
    marginHorizontal: Spacing.base,
    marginTop: -Spacing.xl,
    borderRadius: Radius.xl,
    padding: Spacing.base,
    ...Shadows.md,
    zIndex: 2,
  },
  categoryChip: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.backgroundCard,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.pill,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  categoryText: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: FontWeight.semiBold },
  voucherTitle: {
    fontSize: FontSize['2xl'],
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.base,
  },

  // Points row
  pointsRow: {
    flexDirection: 'row',
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.base,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pointsRequired: { flex: 1, alignItems: 'center' },
  pointsRequiredLabel: { fontSize: FontSize.xs, color: Colors.textMuted, marginBottom: 2 },
  pointsRequiredValue: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  leafEmoji: { fontSize: FontSize.base },
  pointsRequiredNum: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.primary },
  pointsRequiredUnit: { fontSize: FontSize.sm, color: Colors.primary },
  pointsDivider: { width: 1, backgroundColor: Colors.border, marginHorizontal: Spacing.sm },
  pointsValue: { flex: 1, alignItems: 'center' },
  pointsValueLabel: { fontSize: FontSize.xs, color: Colors.textMuted, marginBottom: 2 },
  pointsValueNum: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  pointsBalance: { flex: 1, alignItems: 'center' },
  pointsBalanceLabel: { fontSize: FontSize.xs, color: Colors.textMuted, marginBottom: 2 },
  pointsBalanceNum: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.success },

  insufficientBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.errorLight,
    padding: Spacing.sm,
    borderRadius: Radius.md,
    marginBottom: Spacing.base,
  },
  insufficientText: { fontSize: FontSize.sm, color: Colors.error, flex: 1 },

  sectionLabel: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semiBold,
    color: Colors.textPrimary,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  description: { fontSize: FontSize.base, color: Colors.textSecondary, lineHeight: 22, marginBottom: Spacing.md },

  metaGrid: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.md },
  metaItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.backgroundCard,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  metaLabel: { fontSize: FontSize.xs, color: Colors.textMuted },
  metaValue: { fontSize: FontSize.base, fontWeight: FontWeight.semiBold, color: Colors.textPrimary },

  termRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.xs },
  termBullet: { fontSize: FontSize.base, color: Colors.primary, marginTop: 1 },
  termText: { flex: 1, fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },

  redeemBtn: { marginTop: Spacing.base },

  // Related
  relatedTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    paddingHorizontal: Spacing.base,
    marginTop: Spacing.xl,
    marginBottom: Spacing.md,
  },
  relatedGrid: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.base,
    gap: Spacing.md,
  },
  relatedCard: {
    flex: 1,
    backgroundColor: Colors.backgroundWhite,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    ...Shadows.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  relatedBanner: { height: 70, alignItems: 'center', justifyContent: 'center' },
  relatedEmoji: { fontSize: 30 },
  relatedContent: { padding: Spacing.sm },
  relatedBrand: { fontSize: FontSize.xs, color: Colors.textMuted, marginBottom: 2 },
  relatedName: { fontSize: FontSize.sm, fontWeight: FontWeight.semiBold, color: Colors.textPrimary, marginBottom: Spacing.xs },
  relatedPoints: {
    backgroundColor: Colors.backgroundCard,
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  relatedPointsText: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: FontWeight.medium },

  // Confirm modal
  confirmBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: Spacing.xl },
  confirmSheet: {
    backgroundColor: Colors.backgroundWhite,
    borderRadius: Radius.modal,
    padding: Spacing.xl,
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
    ...Shadows.lg,
  },
  confirmEmoji: { fontSize: 52, marginBottom: Spacing.md },
  confirmTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: Spacing.sm },
  confirmDesc: { fontSize: FontSize.base, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: Spacing.base },
  confirmCost: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingVertical: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  confirmCostLabel: { fontSize: FontSize.base, color: Colors.textMuted },
  confirmCostValue: { fontSize: FontSize.base, fontWeight: FontWeight.semiBold, color: Colors.textPrimary },
  confirmActions: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.base, width: '100%' },
  confirmBtn: { flex: 1 },

  // QR Modal
  qrModal: {
    backgroundColor: Colors.backgroundWhite,
    borderRadius: Radius.modal,
    padding: Spacing.xl,
    alignItems: 'center',
    ...Shadows.lg,
    maxWidth: 340,
    width: '100%',
  },
  qrModalTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: 4 },
  qrModalSub: { fontSize: FontSize.sm, color: Colors.textMuted, marginBottom: Spacing.base },

  // QR code
  qrBox: {
    width: 160,
    height: 160,
    borderWidth: 2,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  qrGrid: { flexDirection: 'row', flexWrap: 'wrap', width: 112, height: 112 },
  qrCell: { width: 16, height: 16, margin: 0 },
  qrCorner: { position: 'absolute', width: 32, height: 32, borderWidth: 3 },
  qrTL: { top: 6, left: 6, borderRightWidth: 0, borderBottomWidth: 0 },
  qrTR: { top: 6, right: 6, borderLeftWidth: 0, borderBottomWidth: 0 },
  qrBL: { bottom: 6, left: 6, borderRightWidth: 0, borderTopWidth: 0 },
  qrCode: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semiBold,
    color: Colors.textMuted,
    marginTop: Spacing.md,
    letterSpacing: 1,
  },

  // Success
  successOverlay: {
    backgroundColor: 'rgba(21,107,47,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  successCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.backgroundWhite,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
    ...Shadows.xl,
  },
  successEmoji: { fontSize: 56 },
  successBadge: { alignItems: 'center' },
  successTitle: { fontSize: FontSize['3xl'], fontWeight: FontWeight.bold, color: Colors.textWhite, textAlign: 'center' },
  successSub: { fontSize: FontSize.base, color: 'rgba(255,255,255,0.8)', marginTop: Spacing.sm, textAlign: 'center' },

  bottomSpacer: { height: Spacing.base },
});
