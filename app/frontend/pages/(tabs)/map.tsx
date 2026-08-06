/**
 * GreenGuard — Map Screen (Leaflet)
 *
 * Uses Leaflet via WebView on native, and WebView html injection on web.
 * Displays recycling stations across Vietnam with search, legend and popups.
 */
import React, { useState, useRef, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Platform,
  Dimensions,
  Modal,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  withTiming,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';

import { AppHeader } from '@/components/common/AppHeader';
import { Button } from '@/components/common/Button';
import { Spacing, FontSize, FontWeight, Radius, Shadows } from '@/theme';
import { useResponsive } from '@/hooks/useResponsive';
import { useTheme } from '@/hooks/useTheme';
import { useI18n } from '@/hooks/useI18n';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RecyclingStation {
  id: string;
  name: string;
  city: string;
  address: string;
  latitude: number;
  longitude: number;
  isOpen: boolean;
  openHours: string;
  distance: string;
  acceptedItems: string[];
  pinColor: string; // Wait, I should make pinColor dynamic or derive from theme. Let's just keep the prop but use theme colors below
}

// ─── Leaflet HTML ─────────────────────────────────────────────────────────────

const buildLeafletHtml = (stations: RecyclingStation[], colors: any, t: any) => {
  const markersJs = stations
    .map(
      (s) => `
      var marker${s.id.replace(/-/g, '_')} = L.circleMarker([${s.latitude}, ${s.longitude}], {
        radius: 12,
        fillColor: '${s.pinColor}',
        color: '${colors.backgroundWhite}',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.9
      }).addTo(map);
      marker${s.id.replace(/-/g, '_')}.bindPopup(
        '<div style="font-family: sans-serif; min-width: 200px; color:${colors.textPrimary};">' +
        '<b style="font-size:14px; color:${colors.primary};">${s.name}</b>' +
        '<p style="margin:4px 0; font-size:12px; color:${colors.textMuted};">${s.address}</p>' +
        '<span style="display:inline-block; padding:2px 8px; border-radius:12px; font-size:11px; background:${s.isOpen ? colors.successLight : colors.errorLight}; color:${s.isOpen ? colors.primary : colors.error};">${s.isOpen ? '● ' + t('map.open', 'Open') : '● ' + t('map.closed', 'Closed')}</span>' +
        '<p style="margin:6px 0; font-size:12px;">🕐 ${s.openHours}</p>' +
        '<p style="margin:4px 0; font-size:12px;">📦 ${s.acceptedItems.join(', ')}</p>' +
        '<p style="margin:4px 0; font-size:12px; color:${colors.textSecondary};">📍 ${s.distance} away</p>' +
        '</div>'
      , { maxWidth: 260 });
    `,
    )
    .join('\n');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #map { width: 100%; height: 100%; background: ${colors.backgroundScreen}; }
    .leaflet-popup-content-wrapper {
      border-radius: 12px !important;
      box-shadow: 0 4px 20px rgba(0,0,0,0.15) !important;
      background: ${colors.backgroundWhite};
      color: ${colors.textPrimary};
    }
    .leaflet-popup-tip { border-top-color: ${colors.backgroundWhite} !important; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', { zoomControl: false }).setView([10.7769, 106.7009], 13);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/${colors.backgroundScreen === '#121212' ? 'dark_all' : 'light_all'}/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 18
    }).addTo(map);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    ${markersJs}

    map.on('click', function(e) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'mapClick', lat: e.latlng.lat, lng: e.latlng.lng }));
      }
    });
  </script>
</body>
</html>
`;
};

// ─── Sub-components ───────────────────────────────────────────────────────────

interface StationCardProps {
  station: RecyclingStation;
  onPress: () => void;
}

const StationCard = ({ station, onPress }: StationCardProps) => {
  const { colors } = useTheme();
  const { t } = useI18n();
  return (
    <TouchableOpacity style={[styles.stationCard, { backgroundColor: colors.backgroundWhite, borderColor: colors.cardBorder }]} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.stationCardLeft}>
        <View style={[styles.stationDot, { backgroundColor: station.pinColor }]} />
        <View style={styles.stationInfo}>
          <Text style={[styles.stationName, { color: colors.textPrimary }]} numberOfLines={1}>{station.name}</Text>
          <Text style={[styles.stationAddress, { color: colors.textMuted }]} numberOfLines={1}>{station.address}</Text>
          <View style={styles.stationMeta}>
            <View style={[styles.statusBadge, { backgroundColor: station.isOpen ? colors.successLight : colors.errorLight }]}>
              <Text style={[styles.statusText, { color: station.isOpen ? colors.primary : colors.error }]}>
                {station.isOpen ? t('map.open', 'Open') : t('map.closed', 'Closed')}
              </Text>
            </View>
            <Text style={[styles.distanceText, { color: colors.textMuted }]}>📍 {station.distance}</Text>
          </View>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
    </TouchableOpacity>
  );
};

interface StationDetailModalProps {
  station: RecyclingStation | null;
  visible: boolean;
  onClose: () => void;
}

const StationDetailModal = ({ station, visible, onClose }: StationDetailModalProps) => {
  const { colors } = useTheme();
  const { t } = useI18n();
  if (!station) return null;
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={[styles.modalSheet, { backgroundColor: colors.backgroundWhite }]} activeOpacity={1}>
          <View style={[styles.modalHandle, { backgroundColor: colors.borderMuted }]} />
          <View style={[styles.modalHeader, { borderBottomColor: colors.divider }]}>
            <View style={[styles.stationDot, styles.stationDotLg, { backgroundColor: station.pinColor }]} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>{station.name}</Text>
              <Text style={[styles.modalCity, { color: colors.textMuted }]}>{station.city}</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <View style={styles.modalBody}>
            <View style={styles.modalRow}>
              <Ionicons name="location-outline" size={18} color={colors.primary} />
              <Text style={[styles.modalRowText, { color: colors.textSecondary }]}>{station.address}</Text>
            </View>
            <View style={styles.modalRow}>
              <Ionicons name="time-outline" size={18} color={colors.primary} />
              <Text style={[styles.modalRowText, { color: colors.textSecondary }]}>{station.openHours}</Text>
            </View>
            <View style={styles.modalRow}>
              <Ionicons name="navigate-outline" size={18} color={colors.primary} />
              <Text style={[styles.modalRowText, { color: colors.textSecondary }]}>{station.distance} {t('map.fromLocation', 'from current location')}</Text>
            </View>

            <View style={[styles.modalRow, { alignItems: 'flex-start' }]}>
              <Ionicons name="leaf-outline" size={18} color={colors.primary} />
              <View style={styles.itemsWrap}>
                {station.acceptedItems.map((item) => (
                  <View key={item} style={[styles.itemChip, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]}>
                    <Text style={[styles.itemChipText, { color: colors.primary }]}>{item}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={[
              styles.statusBanner,
              { backgroundColor: station.isOpen ? colors.successLight : colors.errorLight }
            ]}>
              <Ionicons
                name={station.isOpen ? 'checkmark-circle' : 'close-circle'}
                size={16}
                color={station.isOpen ? colors.primary : colors.error}
              />
              <Text style={[styles.statusBannerText, { color: station.isOpen ? colors.primary : colors.error }]}>
                {station.isOpen ? t('map.currentlyOpen', 'Currently Open') : t('map.currentlyClosed', 'Currently Closed')}
              </Text>
            </View>

            <View style={styles.modalActions}>
              <Button
                label={t('map.navigate', 'Navigate')}
                variant="secondary"
                fullWidth={false}
                style={styles.modalBtn}
                onPress={onClose}
                leftIcon={<Ionicons name="navigate" size={16} color={colors.primary} />}
              />
              <Button
                label={t('map.details', 'Details')}
                variant="primary"
                fullWidth={false}
                style={styles.modalBtn}
                onPress={onClose}
                leftIcon={<Ionicons name="information-circle" size={16} color={colors.textWhite} />}
              />
            </View>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

// ─── Legend ──────────────────────────────────────────────────────────────────

const MapLegend = () => {
  const { colors } = useTheme();
  const { t } = useI18n();
  return (
    <View style={[styles.legend, { backgroundColor: colors.backgroundWhite }]}>
      <Text style={[styles.legendTitle, { color: colors.textPrimary }]}>{t('map.legend', 'Legend')}</Text>
      <View style={styles.legendRow}>
        <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
        <Text style={[styles.legendLabel, { color: colors.textSecondary }]}>{t('map.openStation', 'Open Station')}</Text>
      </View>
      <View style={styles.legendRow}>
        <View style={[styles.legendDot, { backgroundColor: colors.warning }]} />
        <Text style={[styles.legendLabel, { color: colors.textSecondary }]}>{t('map.closedStation', 'Closed Station')}</Text>
      </View>
    </View>
  );
};

// ─── Map Renderer ─────────────────────────────────────────────────────────────

const LeafletMap = ({ stations }: { stations: RecyclingStation[] }) => {
  const { colors } = useTheme();
  const { t } = useI18n();
  const html = buildLeafletHtml(stations, colors, t);

  if (Platform.OS === 'web') {
    return (
      <View style={styles.mapContainer}>
        <iframe
          srcDoc={html}
          style={{ width: '100%', height: '100%', border: 'none' }}
          title="GreenGuard Map"
        />
        <MapLegend />
      </View>
    );
  }

  // Native: use WebView
  let WebView: any = null;
  try {
    const RNWebView = require('react-native-webview');
    WebView = RNWebView.WebView;
  } catch {
    // not installed
  }

  if (!WebView) {
    return (
      <View style={[styles.mapContainer, styles.mapFallback, { backgroundColor: colors.backgroundCard }]}>
        <Ionicons name="map-outline" size={48} color={colors.textMuted} />
        <Text style={[styles.fallbackText, { color: colors.textMuted }]}>{t('map.mapNotAvailable', 'Install react-native-webview to enable the map')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.mapContainer}>
      <WebView
        style={StyleSheet.absoluteFill}
        originWhitelist={['*']}
        source={{ html }}
        javaScriptEnabled
        domStorageEnabled
        allowsInlineMediaPlayback
      />
      <MapLegend />
    </View>
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────

const { height: SCREEN_H } = Dimensions.get('window');

export default function MapScreen() {
  const { isLargeScreen } = useResponsive();
  const { colors } = useTheme();
  const { t } = useI18n();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStation, setSelectedStation] = useState<RecyclingStation | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  // Rebuild mock data colors
  const VIETNAM_STATIONS: RecyclingStation[] = [
    {
      id: 's_001',
      name: 'GreenGuard HCM - Quận 1',
      city: 'Hồ Chí Minh',
      address: '186 Nguyễn Thị Minh Khai, Quận 1, TP.HCM',
      latitude: 10.7769,
      longitude: 106.7009,
      isOpen: true,
      openHours: '07:00 – 20:00',
      distance: '0.5 km',
      acceptedItems: ['Plastic', 'Paper', 'Metal', 'Glass'],
      pinColor: colors.primary,
    },
    {
      id: 's_002',
      name: 'GreenGuard HCM - HCMUT',
      city: 'Hồ Chí Minh',
      address: '268 Lý Thường Kiệt, Quận 10, TP.HCM',
      latitude: 10.7729,
      longitude: 106.658,
      isOpen: true,
      openHours: '06:00 – 22:00',
      distance: '1.2 km',
      acceptedItems: ['Plastic', 'Paper', 'Metal'],
      pinColor: colors.primary,
    },
  ];

  const filtered = VIETNAM_STATIONS.filter((s) => {
    const matchSearch =
      !searchQuery ||
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.address.toLowerCase().includes(searchQuery.toLowerCase());
    return matchSearch;
  });

  const handleStationPress = (station: RecyclingStation) => {
    setSelectedStation(station);
    setModalVisible(true);
  };

  const renderSidebar = () => (
    <>
      {/* Search bar */}
      <View style={[styles.searchCard, { backgroundColor: colors.backgroundWhite, borderColor: colors.cardBorder }]}>
        <Ionicons name="search-outline" size={18} color={colors.textMuted} />
        <TextInput
          style={[styles.searchInput, { color: colors.textPrimary }]}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder={t('map.searchPlaceholder', 'Search stations, cities...')}
          placeholderTextColor={colors.textMuted}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Results count */}
      <View style={styles.resultsRow}>
        <Text style={[styles.resultsCount, { color: colors.textMuted }]}>
          {filtered.length === 1
            ? t('map.stationsFound', '{{count}} station found', { count: filtered.length })
            : t('map.stationsFoundPlural', '{{count}} stations found', { count: filtered.length })}
        </Text>
      </View>

      {/* Station list */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <StationCard station={item} onPress={() => handleStationPress(item)} />
        )}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyList}>
            <Ionicons name="search-outline" size={40} color={colors.borderMuted} />
            <Text style={[styles.emptyListText, { color: colors.textMuted }]}>{t('map.noStationsFound', 'No stations found')}</Text>
          </View>
        }
      />
    </>
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.backgroundScreen }]} edges={['top']}>
      {!isLargeScreen && <AppHeader rightIcon="bell" onRightIconPress={() => { }} />}

      {isLargeScreen ? (
        // ── Desktop: sidebar + map side-by-side
        <View style={styles.desktopLayout}>
          <View style={[styles.desktopSidebar, { backgroundColor: colors.backgroundWhite, borderRightColor: colors.divider }]}>
            <View style={styles.desktopTitleRow}>
              <AppHeader rightIcon="bell" onRightIconPress={() => { }} hideLogo />
            </View>
            <Text style={[styles.titleDesktop, { color: colors.textPrimary }]}>{t('map.title', 'Recycling Stations')}</Text>
            {renderSidebar()}
          </View>
          <View style={styles.desktopMap}>
            <LeafletMap stations={VIETNAM_STATIONS} />
          </View>
        </View>
      ) : (
        // ── Mobile: map top half, list bottom half
        <View style={styles.mobileLayout}>
          <View style={{ height: SCREEN_H * 0.42 }}>
            <LeafletMap stations={VIETNAM_STATIONS} />
          </View>
          <View style={styles.mobileList}>
            {renderSidebar()}
          </View>
        </View>
      )}

      <StationDetailModal
        station={selectedStation}
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1 },

  // Layout
  mobileLayout: { flex: 1 },
  mobileList: { flex: 1 },
  desktopLayout: { flex: 1, flexDirection: 'row' },
  desktopSidebar: {
    width: 380,
    borderRightWidth: 1,
  },
  desktopMap: { flex: 1 },
  desktopTitleRow: { alignItems: 'flex-end' },

  // Titles
  titleMobile: {
    fontSize: FontSize['2xl'],
    fontWeight: FontWeight.bold,
    textAlign: 'center',
    paddingVertical: Spacing.sm,
  },
  titleDesktop: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.sm,
  },

  // Map
  mapContainer: { flex: 1, position: 'relative', overflow: 'hidden' },
  mapFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  fallbackText: {
    fontSize: FontSize.base,
    textAlign: 'center',
    paddingHorizontal: Spacing.xl,
  },

  // Search
  searchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.base,
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 20,
    borderWidth: 1.5,
    gap: Spacing.sm,
    ...Shadows.card,
  },
  searchInput: {
    flex: 1,
    fontSize: FontSize.base,
    paddingVertical: 0,
  },

  // Results
  resultsRow: {
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.xs,
  },
  resultsCount: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },

  // Station card
  listContent: { paddingBottom: Spacing['2xl'] },
  stationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.sm,
    borderRadius: 20,
    padding: Spacing.md,
    borderWidth: 1.5,
    ...Shadows.card,
  },
  stationCardLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  stationDot: { width: 12, height: 12, borderRadius: 6, flexShrink: 0 },
  stationDotLg: { width: 16, height: 16, borderRadius: 8 },
  stationInfo: { flex: 1 },
  stationName: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semiBold,
    marginBottom: 2,
  },
  stationAddress: {
    fontSize: FontSize.sm,
    marginBottom: Spacing.xs,
  },
  stationMeta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  statusText: { fontSize: FontSize.xs, fontWeight: FontWeight.semiBold },
  distanceText: { fontSize: FontSize.xs },

  // Legend
  legend: {
    position: 'absolute',
    bottom: Spacing.base,
    left: Spacing.base,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    ...Shadows.md,
  },
  legendTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semiBold,
    marginBottom: Spacing.xs,
  },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: 4 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { fontSize: FontSize.xs },

  // Empty
  emptyList: { alignItems: 'center', paddingVertical: Spacing['3xl'], gap: Spacing.md },
  emptyListText: { fontSize: FontSize.base },

  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: Radius.modal,
    borderTopRightRadius: Radius.modal,
    paddingBottom: Spacing['2xl'],
    ...Shadows.modal,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.md,
    gap: Spacing.md,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  modalCity: {
    fontSize: FontSize.sm,
    marginTop: 2,
  },
  modalBody: { paddingHorizontal: Spacing.base, paddingTop: Spacing.base },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  modalRowText: {
    flex: 1,
    fontSize: FontSize.base,
    lineHeight: 20,
  },
  itemsWrap: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  itemChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  itemChipText: { fontSize: FontSize.xs, fontWeight: FontWeight.medium },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    marginBottom: Spacing.base,
  },
  statusBannerText: { fontSize: FontSize.base, fontWeight: FontWeight.semiBold },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  modalBtn: { flex: 1 },
});
