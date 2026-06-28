/**
 * GreenGuard — Map Screen
 *
 * Figma sections:
 * 1. AppHeader (logo + bell)
 * 2. Title: "Smart Recycle Bins Spot"
 * 3. Map view with branded pins (react-native-maps)
 * 4. Location search bar below map
 * 5. Filter/Sort row + results count
 * 6. Scrollable collection points list
 */
import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Dimensions,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

// Conditionally require react-native-maps to avoid codegenNativeComponent error on Web
let MapView: any = View;
let Marker: any = View;
let PROVIDER_DEFAULT: any = null;

if (Platform.OS !== 'web') {
  const Maps = require('react-native-maps');
  MapView = Maps.default;
  Marker = Maps.Marker;
  PROVIDER_DEFAULT = Maps.PROVIDER_DEFAULT;
}

import { AppHeader } from '@/components/common/AppHeader';
import { CollectionPointRow } from '@/components/map/CollectionPointRow';
import { Colors, Spacing, FontSize, FontWeight, Radius, Shadows } from '@/theme';
import { MOCK_COLLECTION_POINTS } from '@/constants/mockData';
import { CollectionPoint } from '@/types/collection.types';

import { useResponsive } from '@/hooks/useResponsive';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const MAP_HEIGHT = SCREEN_HEIGHT * 0.38;

const INITIAL_REGION = {
  latitude: 10.7755,
  longitude: 106.6990,
  latitudeDelta: 0.015,
  longitudeDelta: 0.015,
};

export default function MapScreen() {
  const { isLargeScreen } = useResponsive();
  const [searchQuery, setSearchQuery] = useState('Dien Hong Ward, Ho Chi Minh City');
  const [activeFilter, setActiveFilter] = useState('All');

  const filteredPoints = MOCK_COLLECTION_POINTS;

  const renderMap = () => {
    if (Platform.OS === 'web') {
      return (
        <View style={styles.webMapPlaceholder}>
          <Ionicons name="map-outline" size={64} color={Colors.borderMuted} />
          <Text style={styles.webMapText}>Map view is currently unavailable on Web</Text>
        </View>
      );
    }
    
    return (
      <MapView
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        initialRegion={INITIAL_REGION}
        showsUserLocation
        showsMyLocationButton={false}
      >
        {MOCK_COLLECTION_POINTS.map((point) => (
          <Marker
            key={point.id}
            coordinate={{ latitude: point.latitude, longitude: point.longitude }}
            title={point.name}
            description={point.address}
            pinColor={point.brandId === 'brand_hcmut' ? Colors.primary : Colors.mapPinRed}
          />
        ))}
      </MapView>
    );
  };

  const renderSidebarContent = () => (
    <>
      <View style={styles.searchCard}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search location..."
            placeholderTextColor={Colors.textMuted}
          />
          <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="pencil-outline" size={16} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>
        <Text style={styles.locationSubLabel}>Smart Recycle Bins</Text>
      </View>

      <View style={styles.filterRow}>
        <TouchableOpacity style={styles.filterButton}>
          <Ionicons name="filter-outline" size={14} color={Colors.textSecondary} />
          <Text style={styles.filterLabel}>Filter</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.filterButton}>
          <Ionicons name="swap-vertical-outline" size={14} color={Colors.textSecondary} />
          <Text style={styles.filterLabel}>Sort</Text>
        </TouchableOpacity>
        <Text style={styles.resultsCount}>{filteredPoints.length} results</Text>
      </View>

      <FlatList
        data={filteredPoints}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <CollectionPointRow
            point={item}
            onPress={() => {}}
          />
        )}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
      />
    </>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {!isLargeScreen && <AppHeader rightIcon="bell" onRightIconPress={() => {}} />}

      <View style={[styles.container, isLargeScreen && styles.containerDesktop]}>
        {!isLargeScreen && <Text style={styles.title}>Smart Recycle Bins Spot</Text>}

        {isLargeScreen ? (
          <View style={styles.desktopLayout}>
            {/* Left Sidebar for Desktop */}
            <View style={styles.desktopSidebar}>
              <View style={styles.desktopHeaderRow}>
                <AppHeader rightIcon="bell" onRightIconPress={() => {}} hideLogo />
              </View>
              <Text style={styles.titleDesktop}>Smart Recycle Bins Spot</Text>
              {renderSidebarContent()}
            </View>

            {/* Right Map for Desktop */}
            <View style={styles.desktopMapContainer}>
              {renderMap()}
            </View>
          </View>
        ) : (
          <>
            <View style={[styles.mapContainer, { height: MAP_HEIGHT }]}>
              {renderMap()}
            </View>
            {renderSidebarContent()}
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.backgroundWhite,
  },
  container: {
    flex: 1,
  },
  containerDesktop: {
    flexDirection: 'row',
  },
  desktopLayout: {
    flex: 1,
    flexDirection: 'row',
  },
  desktopSidebar: {
    width: 400,
    backgroundColor: Colors.backgroundWhite,
    borderRightWidth: 1,
    borderRightColor: Colors.divider,
    height: '100%',
  },
  desktopMapContainer: {
    flex: 1,
    height: '100%',
  },
  desktopHeaderRow: {
    alignItems: 'flex-end',
    marginBottom: Spacing.xs,
  },
  title: {
    fontSize: FontSize['3xl'],
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    textAlign: 'center',
    paddingHorizontal: Spacing.screenHorizontal,
    marginBottom: Spacing.sm,
  },
  titleDesktop: {
    fontSize: FontSize['2xl'],
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    paddingHorizontal: Spacing.screenHorizontal,
    marginBottom: Spacing.sm,
  },
  mapContainer: {
    width: '100%',
    overflow: 'hidden',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  webMapPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.backgroundCard,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing['2xl'],
  },
  webMapText: {
    marginTop: Spacing.md,
    fontSize: FontSize.lg,
    color: Colors.textMuted,
    textAlign: 'center',
    fontWeight: FontWeight.medium,
  },
  searchCard: {
    marginHorizontal: Spacing.screenHorizontal,
    marginTop: Spacing.sm,
    backgroundColor: Colors.backgroundWhite,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    ...Shadows.card,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: FontSize.base,
    color: Colors.textPrimary,
    paddingVertical: 0,
  },
  locationSubLabel: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    marginTop: Spacing.xs,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.screenHorizontal,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.borderMuted,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  filterLabel: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  resultsCount: {
    marginLeft: 'auto',
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
  listContent: {
    paddingBottom: Spacing['2xl'],
  },
});
