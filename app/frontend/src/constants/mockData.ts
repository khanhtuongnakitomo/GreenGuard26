/**
 * GreenGuard — Mock Data
 * Used during development before backend integration.
 * Replace with real API calls when backend is ready.
 */
import { User, UserStats, HistoryEntry } from '@/types/user.types';
import { Reward, Task, TotalAmount } from '@/types/reward.types';
import { CollectionPoint } from '@/types/collection.types';
import { Colors } from '@/theme/colors';

export const MOCK_USER: User = {
  id: 'usr_001',
  name: 'Minh',
  username: 'minh2007',
  email: 'minh@example.com',
  dateOfBirth: '17.12.2007',
  location: 'Ho Chi Minh City, Vietnam',
  totalPoints: 1250,
  memberTier: 'Green Member',
  rankingTier: 'Silver',
  rankingPoints: 1250,
  rankingMaxPoints: 2000,
};

export const MOCK_USER_STATS: UserStats = {
  monthlyBottles: 34,
  yearlyBottles: 286,
  allTimeBottles: 1248,
  monthlyCans: 12,
};

export const MOCK_HISTORY: HistoryEntry[] = [
  {
    id: 'hist_001',
    createdAt: '2025-08-17T21:30:00Z',
    items: [
      { type: 'Plastic Bottles', quantity: 2, pointsEarned: 20 },
      { type: 'Metal Cans', quantity: 2, pointsEarned: 20 },
    ],
  },
  {
    id: 'hist_002',
    createdAt: '2025-08-10T21:30:00Z',
    items: [
      { type: 'Plastic Bottles', quantity: 2, pointsEarned: 20 },
    ],
  },
];

export const MOCK_REWARDS: Reward[] = [
  {
    id: 'rwd_001',
    brandId: 'brand_cocacola',
    brandName: 'CocaCola',
    brandColor: '#E53935',
    title: '1 CocaCola Bottle',
    expiresAt: '30 Jun 2026',
    status: 'claimable',
  },
  {
    id: 'rwd_002',
    brandId: 'brand_pepsi',
    brandName: 'Pepsi',
    brandColor: '#1565C0',
    title: '1 Pepsi Cans',
    expiresAt: '20 Jun 2026',
    status: 'claimable',
  },
  {
    id: 'rwd_003',
    brandId: 'brand_milo',
    brandName: 'Milo',
    brandColor: '#4E342E',
    title: 'Milo discount 10%',
    expiresAt: '2 Jun 2026',
    status: 'claimed',
  },
  {
    id: 'rwd_004',
    brandId: 'brand_aquafina',
    brandName: 'AquaFina',
    brandColor: '#1565C0',
    title: 'Free 1 Aqua bottle',
    expiresAt: '15 Jun 2026',
    status: 'claimed',
  },
];

export const MOCK_HOME_REWARDS: Reward[] = [
  {
    id: 'hrwd_001',
    brandId: 'brand_hcmut',
    brandName: 'HCMUT',
    brandColor: '#1565C0',
    title: 'Digital parking ticket',
    expiresAt: 'Ongoing',
    status: 'claimable',
    pointsValue: 2000,
  },
  {
    id: 'hrwd_002',
    brandId: 'brand_cocacola',
    brandName: 'CocaCola',
    brandColor: '#E53935',
    title: 'Promocode',
    expiresAt: 'Ongoing',
    status: 'claimable',
  },
  {
    id: 'hrwd_003',
    brandId: 'brand_aquafina',
    brandName: 'AquaFina',
    brandColor: '#1565C0',
    title: 'Free drink at Circle K',
    expiresAt: 'Ongoing',
    status: 'claimable',
  },
];

export const MOCK_TASKS: Task[] = [
  {
    id: 'task_001',
    brandId: 'brand_cocacola',
    brandName: 'CocaCola',
    brandColor: '#E53935',
    title: 'Obtain 100pts',
    targetPoints: 100,
    currentPoints: 80,
    expiresAt: 'Dec 2026',
    status: 'in_progress',
  },
  {
    id: 'task_002',
    brandId: 'brand_cocacola',
    brandName: 'CocaCola',
    brandColor: '#E53935',
    title: 'Obtain 100pts',
    targetPoints: 100,
    currentPoints: 100,
    expiresAt: 'Dec 2026',
    status: 'completed',
  },
  {
    id: 'task_003',
    brandId: 'brand_cocacola',
    brandName: 'CocaCola',
    brandColor: '#E53935',
    title: 'Obtain 100pts',
    targetPoints: 100,
    currentPoints: 100,
    expiresAt: 'Dec 2026',
    status: 'completed',
  },
  {
    id: 'task_004',
    brandId: 'brand_cocacola',
    brandName: 'CocaCola',
    brandColor: '#E53935',
    title: 'Obtain 100pts',
    targetPoints: 100,
    currentPoints: 100,
    expiresAt: 'Dec 2026',
    status: 'completed',
  },
];

export const MOCK_REWARD_TASKS_PROGRESS = [
  { id: 'tp_001', label: 'Aqua Bottles', current: 70, target: 100 },
  { id: 'tp_002', label: 'Pepsi Cans', current: 85, target: 100 },
  { id: 'tp_003', label: 'Milo Papers', current: 30, target: 100 },
];

export const MOCK_TOTAL_AMOUNT: TotalAmount = {
  totalKg: 15,
  breakdown: [
    { label: 'Plastic', percentage: 40, color: Colors.chartPlastic },
    { label: 'Paper', percentage: 13.5, color: Colors.chartPaper },
    { label: 'Metal', percentage: 11, color: Colors.chartMetal },
    { label: 'Others', percentage: 15, color: Colors.chartOthers },
    { label: 'Glass', percentage: 9.5, color: Colors.chartGlass },
  ],
};

export const MOCK_COLLECTION_POINTS: CollectionPoint[] = [
  {
    id: 'cp_001',
    name: '#CocaCola1',
    brandId: 'brand_cocacola',
    brandName: 'CocaCola',
    brandColor: '#E53935',
    address: '186 Dien Hong Ward, Ho Chi Minh City',
    latitude: 10.7769,
    longitude: 106.7009,
    isActive: true,
  },
  {
    id: 'cp_002',
    name: '#HCMUT1',
    brandId: 'brand_hcmut',
    brandName: 'HCMUT',
    brandColor: '#1565C0',
    address: 'CircleK, HCMUT',
    latitude: 10.7729,
    longitude: 106.6580,
    isActive: true,
  },
  {
    id: 'cp_003',
    name: '#Pepsi1',
    brandId: 'brand_pepsi',
    brandName: 'Pepsi',
    brandColor: '#1565C0',
    address: 'Dien Hong Ward, Ho Chi Minh City',
    latitude: 10.7755,
    longitude: 106.6973,
    isActive: true,
  },
  {
    id: 'cp_004',
    name: '#AquaFina1',
    brandId: 'brand_aquafina',
    brandName: 'AquaFina',
    brandColor: '#1565C0',
    address: 'Ho Chi Minh City',
    latitude: 10.7780,
    longitude: 106.7030,
    isActive: true,
  },
];
