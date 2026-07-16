/**
 * GreenGuard — Map Screen (Leaflet)
 *
 * Uses Leaflet via WebView on native, and WebView html injection on web.
 * Displays recycling stations across Vietnam with search, legend and popups.
 */
import React, { useState, useRef, useCallback, useMemo } from 'react';
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
import { Colors, Spacing, FontSize, FontWeight, Radius, Shadows } from '@/theme';
import { useResponsive } from '@/hooks/useResponsive';
import { useCollectionPoints } from '@/hooks/useApi';

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
  pinColor: string;
}

// ─── Mock Data ─────────────────────────────────────────────────────────────────

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
    pinColor: Colors.primary,
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
    pinColor: Colors.primary,
  },
  {
    id: 's_003',
    name: 'GreenGuard Hà Nội - Hoàn Kiếm',
    city: 'Hà Nội',
    address: '1 Đinh Tiên Hoàng, Hoàn Kiếm, Hà Nội',
    latitude: 21.0285,
    longitude: 105.8542,
    isOpen: true,
    openHours: '07:00 – 21:00',
    distance: '1,200 km',
    acceptedItems: ['Plastic', 'Paper', 'Metal', 'Glass'],
    pinColor: Colors.primaryLight,
  },
  {
    id: 's_004',
    name: 'GreenGuard Đà Nẵng - Hải Châu',
    city: 'Đà Nẵng',
    address: '78 Phan Châu Trinh, Hải Châu, Đà Nẵng',
    latitude: 16.0678,
    longitude: 108.2208,
    isOpen: false,
    openHours: '08:00 – 18:00',
    distance: '780 km',
    acceptedItems: ['Plastic', 'Metal'],
    pinColor: Colors.warning,
  },
  {
    id: 's_005',
    name: 'GreenGuard Cần Thơ - Ninh Kiều',
    city: 'Cần Thơ',
    address: '2 Hai Bà Trưng, Ninh Kiều, Cần Thơ',
    latitude: 10.0452,
    longitude: 105.7469,
    isOpen: true,
    openHours: '07:00 – 19:00',
    distance: '170 km',
    acceptedItems: ['Plastic', 'Paper', 'Glass'],
    pinColor: Colors.primary,
  },
  {
    id: 's_006',
    name: 'GreenGuard Hải Phòng - Lê Chân',
    city: 'Hải Phòng',
    address: '5 Đinh Tiên Hoàng, Lê Chân, Hải Phòng',
    latitude: 20.8449,
    longitude: 106.6881,
    isOpen: true,
    openHours: '06:30 – 20:30',
    distance: '1,100 km',
    acceptedItems: ['Plastic', 'Paper', 'Metal', 'Glass'],
    pinColor: Colors.primaryLight,
  },
];

// ─── Leaflet HTML ─────────────────────────────────────────────────────────────

const buildLeafletHtml = (stations: RecyclingStation[]) => {
  const markersJs = stations
    .map(
      (s) => `
      var marker${s.id.replace(/-/g, '_')} = L.circleMarker([${s.latitude}, ${s.longitude}], {
        radius: 12,
        fillColor: '${s.pinColor}',
        color: '#fff',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.9
      }).addTo(map);
      marker${s.id.replace(/-/g, '_')}.bindPopup(
        '<div style="font-family: sans-serif; min-width: 200px;">' +
        '<b style="font-size:14px; color:#156B2F;">${s.name}</b>' +
        '<p style="margin:4px 0; font-size:12px; color:#555;">${s.address}</p>' +
        '<span style="display:inline-block; padding:2px 8px; border-radius:12px; font-size:11px; background:${s.isOpen ? '#D4EDAA' : '#FEE2E2'}; color:${s.isOpen ? '#156B2F' : '#EF4444'};">${s.isOpen ? '● Open' : '● Closed'}</span>' +
        '<p style="margin:6px 0; font-size:12px;">🕐 ${s.openHours}</p>' +
        '<p style="margin:4px 0; font-size:12px;">📦 ${s.acceptedItems.join(', ')}</p>' +
        '<p style="margin:4px 0; font-size:12px; color:#4A4A4A;">📍 ${s.distance} away</p>' +
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
    html, body, #map { width: 100%; height: 100%; }
    .leaflet-popup-content-wrapper {
      border-radius: 12px !important;
      box-shadow: 0 4px 20px rgba(0,0,0,0.15) !important;
    }
    .leaflet-popup-tip { display: none; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', { zoomControl: false }).setView([16.0, 106.0], 6);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
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

const StationCard = ({ station, onPress }: StationCardProps) => (
  <TouchableOpacity style={styles.stationCard} onPress={onPress} activeOpacity={0.8}>
    <View style={styles.stationCardLeft}>
      <View style={[styles.stationDot, { backgroundColor: station.pinColor }]} />
      <View style={styles.stationInfo}>
        <Text style={styles.stationName} numberOfLines={1}>{station.name}</Text>
        <Text style={styles.stationAddress} numberOfLines={1}>{station.address}</Text>
        <View style={styles.stationMeta}>
          <View style={[styles.statusBadge, station.isOpen ? styles.statusOpen : styles.statusClosed]}>
            <Text style={[styles.statusText, { color: station.isOpen ? Colors.primary : Colors.error }]}>
              {station.isOpen ? 'Open' : 'Closed'}
            </Text>
          </View>
          <Text style={styles.distanceText}>📍 {station.distance}</Text>
        </View>
      </View>
    </View>
    <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
  </TouchableOpacity>
);

interface StationDetailModalProps {
  station: RecyclingStation | null;
  visible: boolean;
  onClose: () => void;
}

const StationDetailModal = ({ station, visible, onClose }: StationDetailModalProps) => {
  if (!station) return null;
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={styles.modalSheet} activeOpacity={1}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <View style={[styles.stationDot, styles.stationDotLg, { backgroundColor: station.pinColor }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitle}>{station.name}</Text>
              <Text style={styles.modalCity}>{station.city}</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          <View style={styles.modalBody}>
            <View style={styles.modalRow}>
              <Ionicons name="location-outline" size={18} color={Colors.primary} />
              <Text style={styles.modalRowText}>{station.address}</Text>
            </View>
            <View style={styles.modalRow}>
              <Ionicons name="time-outline" size={18} color={Colors.primary} />
              <Text style={styles.modalRowText}>{station.openHours}</Text>
            </View>
            <View style={styles.modalRow}>
              <Ionicons name="navigate-outline" size={18} color={Colors.primary} />
              <Text style={styles.modalRowText}>{station.distance} from current location</Text>
            </View>

            <View style={[styles.modalRow, { alignItems: 'flex-start' }]}>
              <Ionicons name="leaf-outline" size={18} color={Colors.primary} />
              <View style={styles.itemsWrap}>
                {station.acceptedItems.map((item) => (
                  <View key={item} style={styles.itemChip}>
                    <Text style={styles.itemChipText}>{item}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={[
              styles.statusBanner,
              station.isOpen ? styles.statusBannerOpen : styles.statusBannerClosed,
            ]}>
              <Ionicons
                name={station.isOpen ? 'checkmark-circle' : 'close-circle'}
                size={16}
                color={station.isOpen ? Colors.primary : Colors.error}
              />
              <Text style={[styles.statusBannerText, { color: station.isOpen ? Colors.primary : Colors.error }]}>
                {station.isOpen ? 'Currently Open' : 'Currently Closed'}
              </Text>
            </View>

            <View style={styles.modalActions}>
              <Button
                label="Navigate"
                variant="secondary"
                fullWidth={false}
                style={styles.modalBtn}
                onPress={onClose}
                leftIcon={<Ionicons name="navigate" size={16} color={Colors.primary} />}
              />
              <Button
                label="Details"
                variant="primary"
                fullWidth={false}
                style={styles.modalBtn}
                onPress={onClose}
                leftIcon={<Ionicons name="information-circle" size={16} color={Colors.textWhite} />}
              />
            </View>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

// ─── Legend ──────────────────────────────────────────────────────────────────

const MapLegend = () => (
  <View style={styles.legend}>
    <Text style={styles.legendTitle}>Legend</Text>
    <View style={styles.legendRow}>
      <View style={[styles.legendDot, { backgroundColor: Colors.primary }]} />
      <Text style={styles.legendLabel}>Open Station</Text>
    </View>
    <View style={styles.legendRow}>
      <View style={[styles.legendDot, { backgroundColor: Colors.warning }]} />
      <Text style={styles.legendLabel}>Closed Station</Text>
    </View>
  </View>
);

// ─── Map Renderer ─────────────────────────────────────────────────────────────

const LeafletMap = ({ stations }: { stations: RecyclingStation[] }) => {
  const html = buildLeafletHtml(stations);

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
      <View style={[styles.mapContainer, styles.mapFallback]}>
        <Ionicons name="map-outline" size={48} color={Colors.textMuted} />
        <Text style={styles.fallbackText}>Install react-native-webview to enable the map</Text>
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
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStation, setSelectedStation] = useState<RecyclingStation | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [cityFilter, setCityFilter] = useState('All');
  const { data: apiPoints = [] } = useCollectionPoints(searchQuery || undefined);

  const stations = useMemo<RecyclingStation[]>(() => {
    if (!apiPoints.length) return VIETNAM_STATIONS;
    return apiPoints.map((p) => ({
      id: p.id,
      name: p.name,
      city: p.address.split(',').slice(-1)[0]?.trim() || 'Campus',
      address: p.address,
      latitude: p.latitude,
      longitude: p.longitude,
      isOpen: p.status === 'online' || p.isActive,
      openHours: p.status === 'maintenance' ? 'Maintenance' : '06:00 – 22:00',
      distance: p.machineCode ? `#${p.machineCode}` : '',
      acceptedItems: ['Plastic', 'Metal', 'Carton'],
      pinColor: p.brandColor ?? Colors.primary,
    }));
  }, [apiPoints]);

  const cities = ['All', ...Array.from(new Set(stations.map((s) => s.city)))];

  const filtered = stations.filter((s) => {
    const matchCity = cityFilter === 'All' || s.city === cityFilter;
    const matchSearch =
      !searchQuery ||
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.address.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCity && matchSearch;
  });

  const handleStationPress = (station: RecyclingStation) => {
    setSelectedStation(station);
    setModalVisible(true);
  };

  const renderSidebar = () => (
    <>
      {/* Search bar */}
      <View style={styles.searchCard}>
        <Ionicons name="search-outline" size={18} color={Colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search stations, cities..."
          placeholderTextColor={Colors.textMuted}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* City filter pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.cityFilterScroll}
      >
        {cities.map((city) => (
          <TouchableOpacity
            key={city}
            style={[styles.cityChip, cityFilter === city && styles.cityChipActive]}
            onPress={() => setCityFilter(city)}
          >
            <Text style={[styles.cityChipText, cityFilter === city && styles.cityChipTextActive]}>
              {city}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Results count */}
      <View style={styles.resultsRow}>
        <Text style={styles.resultsCount}>{filtered.length} station{filtered.length !== 1 ? 's' : ''} found</Text>
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
            <Ionicons name="search-outline" size={40} color={Colors.borderMuted} />
            <Text style={styles.emptyListText}>No stations found</Text>
          </View>
        }
      />
    </>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {!isLargeScreen && <AppHeader rightIcon="bell" onRightIconPress={() => {}} />}

      {isLargeScreen ? (
        // ── Desktop: sidebar + map side-by-side
        <View style={styles.desktopLayout}>
          <View style={styles.desktopSidebar}>
            <View style={styles.desktopTitleRow}>
              <AppHeader rightIcon="bell" onRightIconPress={() => {}} hideLogo />
            </View>
            <Text style={styles.titleDesktop}>Recycling Stations</Text>
            {renderSidebar()}
          </View>
          <View style={styles.desktopMap}>
            <LeafletMap stations={stations} />
          </View>
        </View>
      ) : (
        // ── Mobile: map top half, list bottom half
        <View style={styles.mobileLayout}>
          <View style={{ height: SCREEN_H * 0.42 }}>
            <LeafletMap stations={stations} />
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
  safe: { flex: 1, backgroundColor: Colors.backgroundScreen },

  // Layout
  mobileLayout: { flex: 1 },
  mobileList: { flex: 1 },
  desktopLayout: { flex: 1, flexDirection: 'row' },
  desktopSidebar: {
    width: 380,
    backgroundColor: Colors.backgroundWhite,
    borderRightWidth: 1,
    borderRightColor: Colors.divider,
  },
  desktopMap: { flex: 1 },
  desktopTitleRow: { alignItems: 'flex-end' },

  // Titles
  titleMobile: {
    fontSize: FontSize['2xl'],
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    textAlign: 'center',
    paddingVertical: Spacing.sm,
  },
  titleDesktop: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.sm,
  },

  // Map
  mapContainer: { flex: 1, position: 'relative', overflow: 'hidden' },
  mapFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.backgroundCard,
    gap: Spacing.md,
  },
  fallbackText: {
    fontSize: FontSize.base,
    color: Colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: Spacing.xl,
  },

  // Search
  searchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundWhite,
    marginHorizontal: Spacing.base,
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.sm,
    ...Shadows.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: FontSize.base,
    color: Colors.textPrimary,
    paddingVertical: 0,
  },

  // City chips
  cityFilterScroll: {
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  cityChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.backgroundWhite,
  },
  cityChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  cityChipText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
  },
  cityChipTextActive: { color: Colors.textWhite },

  // Results
  resultsRow: {
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.xs,
  },
  resultsCount: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    fontWeight: FontWeight.medium,
  },

  // Station card
  listContent: { paddingBottom: Spacing['2xl'] },
  stationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.sm,
    backgroundColor: Colors.backgroundWhite,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.xs,
  },
  stationCardLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  stationDot: { width: 12, height: 12, borderRadius: 6, flexShrink: 0 },
  stationDotLg: { width: 16, height: 16, borderRadius: 8 },
  stationInfo: { flex: 1 },
  stationName: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semiBold,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  stationAddress: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    marginBottom: Spacing.xs,
  },
  stationMeta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  statusOpen: { backgroundColor: Colors.successLight },
  statusClosed: { backgroundColor: Colors.errorLight },
  statusText: { fontSize: FontSize.xs, fontWeight: FontWeight.semiBold },
  distanceText: { fontSize: FontSize.xs, color: Colors.textMuted },

  // Legend
  legend: {
    position: 'absolute',
    bottom: Spacing.base,
    left: Spacing.base,
    backgroundColor: Colors.backgroundWhite,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    ...Shadows.md,
  },
  legendTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semiBold,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: 4 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { fontSize: FontSize.xs, color: Colors.textSecondary },

  // Empty
  emptyList: { alignItems: 'center', paddingVertical: Spacing['3xl'], gap: Spacing.md },
  emptyListText: { fontSize: FontSize.base, color: Colors.textMuted },

  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: Colors.backgroundWhite,
    borderTopLeftRadius: Radius.modal,
    borderTopRightRadius: Radius.modal,
    paddingBottom: Spacing['2xl'],
    ...Shadows.modal,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.borderMuted,
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
    borderBottomColor: Colors.divider,
  },
  modalTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  modalCity: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
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
    color: Colors.textSecondary,
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
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  itemChipText: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: FontWeight.medium },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    marginBottom: Spacing.base,
  },
  statusBannerOpen: { backgroundColor: Colors.successLight },
  statusBannerClosed: { backgroundColor: Colors.errorLight },
  statusBannerText: { fontSize: FontSize.base, fontWeight: FontWeight.semiBold },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  modalBtn: { flex: 1 },
});
