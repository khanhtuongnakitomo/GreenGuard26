import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text as NativeText, TextInput, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useFonts } from 'expo-font';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BadgeCheck, CircleAlert, LogOut, Plus, RefreshCw, ShieldCheck, TicketPercent, Trash2, UploadCloud } from 'lucide-react-native';
import { DashboardSidebar, SIDEBAR_WIDTH } from '@/components/DashboardSidebar';
import { DashboardTopNav } from '@/components/DashboardTopNav';
import VoucherFilePicker from '@/components/VoucherFilePicker';
import { Colors } from '@/theme/colors';
import { DashboardRoute } from '@/types/dashboard.types';
import { AdminPartner, AdminReward, AdminSession, normalizeExpiryDate, RewardInput, VoucherApiError, voucherAdminApi } from '@/services/voucherAdmin';

interface Props { onNavigate: (route: DashboardRoute) => void; }
type TextProps = React.ComponentProps<typeof NativeText>;
const Text = ({ style, ...props }: TextProps) => {
  const textStyle = StyleSheet.flatten(style);
  const weight = Number(textStyle?.fontWeight || 400);
  const fontFamily = weight >= 700 ? 'Inter_700Bold' : weight >= 600 ? 'Inter_600SemiBold' : weight >= 500 ? 'Inter_500Medium' : 'Inter_400Regular';
  return <NativeText {...props} style={[{ fontFamily }, style]} />;
};
type FileState = { id: string; file: File; preview: string; state: 'queued' | 'uploading' | 'success' | 'error'; message?: string; };
const SESSION_KEY = 'greenguard-voucher-admin-session';
const REWARD_TYPES = ['parking_ticket', 'meal_voucher', 'promo_code', 'free_item', 'discount', 'food_beverage', 'stationery'] as const;
const emptyForm = { partnerId: '', name: '', description: '', rewardType: 'discount', pointsRequired: '', validUntil: '', terms: '', imageUrl: '', status: 'active' };
const toInput = (form: typeof emptyForm): RewardInput => ({
  partnerId: form.partnerId,
  name: form.name.trim(),
  description: form.description.trim(),
  rewardType: form.rewardType.trim() || 'discount',
  pointsRequired: Number(form.pointsRequired),
  ...(normalizeExpiryDate(form.validUntil) ? { validUntil: normalizeExpiryDate(form.validUntil) } : {}),
  terms: form.terms.split('\n').map(line => line.trim()).filter(Boolean),
  ...(form.imageUrl.trim() ? { imageUrl: form.imageUrl.trim() } : {}),
  deliveryType: 'barcode',
  status: form.status as 'active' | 'inactive' | 'expired',
});
const getPartnerName = (partner: AdminReward['partnerId']) => typeof partner === 'string' ? partner : partner?.name || '';

export default function VouchersScreen({ onNavigate }: Props) {
  useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });
  const { width } = useWindowDimensions();
  const compact = width < 980;
  const mobile = width < 720;
  const [session, setSession] = useState<AdminSession | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [loginPhone, setLoginPhone] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);
  const [authMessage, setAuthMessage] = useState('');
  const [forbidden, setForbidden] = useState(false);
  const [rewards, setRewards] = useState<AdminReward[]>([]);
  const [partners, setPartners] = useState<AdminPartner[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [selectedRewardId, setSelectedRewardId] = useState('new');
  const [partnerName, setPartnerName] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [files, setFiles] = useState<FileState[]>([]);
  const [uploading, setUploading] = useState(false);
  const generation = useRef(0);
  const controllers = useRef(new Set<AbortController>());
  const busyRef = useRef(false);
  const loginBusyRef = useRef(false);
  const fileUrls = useRef(new Set<string>());

  const abortSessionRequests = useCallback(() => {
    generation.current += 1;
    controllers.current.forEach(controller => controller.abort());
    controllers.current.clear();
  }, []);
  const invalidateSession = useCallback((message = '') => {
    abortSessionRequests();
    busyRef.current = false;
    try { if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(SESSION_KEY); } catch { /* private mode */ }
    setSession(null); setRewards([]); setPartners([]); fileUrls.current.forEach(url => URL.revokeObjectURL(url)); fileUrls.current.clear(); setFiles([]); setForm(emptyForm); setSelectedRewardId('new');
    setForbidden(false); setAuthMessage(message); setNotice(''); setLoading(false); setSaving(false); setUploading(false);
  }, [abortSessionRequests]);
  const newController = () => { const controller = new AbortController(); controllers.current.add(controller); return controller; };
  const guarded = async <T,>(token: string, operation: (signal: AbortSignal) => Promise<T>): Promise<T | undefined> => {
    const requestGeneration = generation.current;
    const controller = newController();
    try {
      const value = await operation(controller.signal);
      return requestGeneration === generation.current ? value : undefined;
    } catch (error) {
      if ((error as Error).name === 'AbortError' || requestGeneration !== generation.current) return undefined;
      if (error instanceof VoucherApiError && error.status === 401) invalidateSession('Your admin session expired. Sign in again to continue.');
      throw error;
    } finally { controllers.current.delete(controller); }
  };

  const loadCatalog = useCallback(async (active: AdminSession) => {
    setLoading(true); setAuthMessage('');
    try {
      const [nextRewards, nextPartners] = await Promise.all([
        guarded(active.accessToken, signal => voucherAdminApi.rewards(active.accessToken, signal)),
        guarded(active.accessToken, signal => voucherAdminApi.partners(active.accessToken, signal)),
      ]);
      if (nextRewards && nextPartners) { setRewards(nextRewards); setPartners(nextPartners); }
    } catch (error) { setAuthMessage(error instanceof Error ? error.message : 'Could not load the voucher catalog.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const raw = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(SESSION_KEY) : null;
        if (raw) {
          const saved = JSON.parse(raw) as AdminSession;
          if (saved.accessToken) {
            const restoreGeneration = generation.current;
            const me = await voucherAdminApi.me(saved.accessToken);
            if (restoreGeneration !== generation.current) return;
            if (me.role?.toLowerCase() !== 'admin') { try { sessionStorage.removeItem(SESSION_KEY); } catch { /* private mode */ } if (active) { setForbidden(true); setAuthMessage('This account does not have the admin role. Sign in with an administrator account.'); } }
            else if (active) {
              const verified = { accessToken: saved.accessToken, userId: String(me._id || me.id || saved.userId), displayName: me.displayName || me.phoneNumber || 'Voucher admin' };
              setSession(verified); void loadCatalog(verified);
            }
          }
        }
      } catch (error) {
        try { sessionStorage.removeItem(SESSION_KEY); } catch { /* private mode */ }
        if (active && (error as VoucherApiError)?.status !== 401) setAuthMessage(error instanceof Error ? error.message : 'Could not verify the saved admin session.');
      } finally { if (active) setSessionChecked(true); }
    })();
    return () => { active = false; abortSessionRequests(); };
  }, [abortSessionRequests, loadCatalog]);

  const signIn = async () => {
    if (loginBusyRef.current || !loginPhone.trim() || !loginPassword) return;
    loginBusyRef.current = true;
    abortSessionRequests(); setLoginBusy(true); setForbidden(false); setAuthMessage('');
    const loginGeneration = generation.current;
    const controller = newController();
    try {
      const tokens = await voucherAdminApi.login(loginPhone, loginPassword, controller.signal);
      if (loginGeneration !== generation.current) return;
      const user = await voucherAdminApi.me(tokens.accessToken, controller.signal);
      if (loginGeneration !== generation.current) return;
      if (user.role?.toLowerCase() !== 'admin') { setLoginPassword(''); setForbidden(true); setAuthMessage('Sign in succeeded, but this account does not have the admin role.'); return; }
      const verified = { accessToken: tokens.accessToken, userId: String(user._id || user.id || ''), displayName: user.displayName || user.phoneNumber || 'Voucher admin' };
      try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(verified)); } catch { /* tab memory still works */ }
      setSession(verified); setLoginPassword(''); setAuthMessage(''); void loadCatalog(verified);
    } catch (error) {
      if ((error as Error).name !== 'AbortError') setAuthMessage(error instanceof Error ? error.message : 'Sign in failed.');
    } finally { controllers.current.delete(controller); loginBusyRef.current = false; setLoginBusy(false); }
  };

  const signOut = () => invalidateSession('');
  const selectExisting = (id: string) => {
    setSelectedRewardId(id); setNotice('');
    fileUrls.current.forEach(url => URL.revokeObjectURL(url)); fileUrls.current.clear(); setFiles([]);
    if (id === 'new') { setForm({ ...emptyForm, partnerId: partners[0]?._id || '' }); return; }
    const reward = rewards.find(row => row._id === id); if (!reward) return;
    setForm({ partnerId: typeof reward.partnerId === 'string' ? reward.partnerId : reward.partnerId._id, name: reward.name, description: reward.description || '', rewardType: reward.rewardType, pointsRequired: String(reward.pointsRequired), validUntil: reward.validUntil ? reward.validUntil.slice(0, 10) : '', terms: (reward.terms || []).join('\n'), imageUrl: reward.imageUrl || '', status: (reward.status || 'active') as 'active' | 'inactive' | 'expired' });
  };
  const addFiles = (incoming: File[]) => {
    setNotice('');
    const queue = [...files]; const known = new Set(queue.map(item => `${item.file.name}:${item.file.size}:${item.file.lastModified}`));
    let rejected = 0;
    for (const file of incoming) {
      if (!['image/png', 'image/jpeg'].includes(file.type.toLowerCase()) || file.size > 2 * 1024 * 1024 || queue.length >= 20 || known.has(`${file.name}:${file.size}:${file.lastModified}`)) { rejected++; continue; }
      known.add(`${file.name}:${file.size}:${file.lastModified}`);
      const preview = URL.createObjectURL(file); fileUrls.current.add(preview);
      queue.push({ id: `${file.name}-${file.size}-${file.lastModified}-${Math.random()}`, file, preview, state: 'queued' });
    }
    setFiles(queue);
    if (rejected) setNotice(`${rejected} file${rejected === 1 ? ' was' : 's were'} skipped (unsupported type, duplicate in this queue, over 2 MiB, or batch limit reached).`);
  };
  const removeFile = (file: FileState) => { if (file.state !== 'queued' && file.state !== 'error') return; URL.revokeObjectURL(file.preview); fileUrls.current.delete(file.preview); setFiles(current => current.filter(item => item.id !== file.id)); };
  const clearCompleted = () => {
    if (uploading || saving) return;
    const completed = files.filter(item => item.state === 'success');
    completed.forEach(item => { URL.revokeObjectURL(item.preview); fileUrls.current.delete(item.preview); });
    setFiles(current => current.filter(item => item.state !== 'success'));
  };
  useEffect(() => () => { abortSessionRequests(); fileUrls.current.forEach(url => URL.revokeObjectURL(url)); fileUrls.current.clear(); }, [abortSessionRequests]);

  const saveReward = async (statusOverride?: 'active' | 'inactive' | 'expired'): Promise<string | undefined> => {
    if (!session) return;
    if (loading) { setNotice('Wait for the reward catalog to finish loading before saving.'); return; }
    if (!form.partnerId || !form.name.trim() || !Number(form.pointsRequired) || Number(form.pointsRequired) < 1) { setNotice('Choose a partner and enter an offer name and points cost before saving.'); return; }
    try { normalizeExpiryDate(form.validUntil); } catch (error) { setNotice(error instanceof Error ? error.message : 'Enter a valid expiry date in YYYY-MM-DD format.'); return; }
    const existing = selectedRewardId === 'new' ? undefined : rewards.find(reward => reward._id === selectedRewardId);
    if (existing?.validUntil && !form.validUntil.trim()) { setNotice('The current API cannot clear an existing expiry date. Restore the saved date to continue.'); return; }
    if (existing?.imageUrl && !form.imageUrl.trim()) { setNotice('The current API cannot clear existing catalog artwork. Restore the saved artwork URL to continue.'); return; }
    setSaving(true); setNotice('');
    try {
      const input = toInput(form);
      if (statusOverride) input.status = statusOverride;
      const result = await guarded(session.accessToken, signal => selectedRewardId === 'new'
        ? voucherAdminApi.createReward(session.accessToken, input, signal)
        : voucherAdminApi.updateReward(session.accessToken, selectedRewardId, input, signal));
      if (!result) return;
      setSelectedRewardId(result._id); setRewards(current => [result, ...current.filter(item => item._id !== result._id)]);
      if (statusOverride) setForm(current => ({ ...current, status: statusOverride }));
      setNotice(statusOverride ? `Offer ${statusOverride === 'active' ? 'activated in' : 'paused from'} the Rewards catalog.` : 'Offer saved. Active offers appear in the Rewards catalog; voucher stock is the number of unique images accepted below.');
      return result._id;
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Could not save the offer.'); }
    finally { setSaving(false); }
  };
  const ensurePartner = async () => {
    if (!session || !partnerName.trim()) return;
    const requestGeneration = generation.current;
    try {
      const partner = await guarded(session.accessToken, signal => voucherAdminApi.createPartner(session.accessToken, partnerName, signal));
      if (!partner || requestGeneration !== generation.current) return;
      setPartners(current => [...current, partner]); setForm(current => ({ ...current, partnerId: partner._id })); setPartnerName('');
      setNotice(`Partner “${partner.name}” created and selected.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Could not create the partner.'); }
  };
  const uploadBatch = async () => {
    if (busyRef.current || loading || !session) return;
    const pending = files.filter(file => file.state === 'queued' || file.state === 'error');
    if (!pending.length) { setNotice('Add at least one barcode image to upload.'); return; }
    busyRef.current = true;
    setUploading(true); setNotice('Uploading each unique barcode as its own voucher. Successful images will be kept out of retries.');
    const requestGeneration = generation.current;
    const rewardId = await saveReward();
    if (!rewardId || requestGeneration !== generation.current) { setUploading(false); busyRef.current = false; return; }
    let successCount = 0; let failureCount = 0;
    for (const item of pending) {
      if (requestGeneration !== generation.current) break;
      setFiles(current => current.map(row => row.id === item.id ? { ...row, state: 'uploading', message: undefined } : row));
      try {
        const result = await guarded(session.accessToken, signal => voucherAdminApi.uploadBarcode(session.accessToken, rewardId!, item.file, signal));
        if (!result) break;
        successCount++;
        setFiles(current => current.map(row => row.id === item.id ? { ...row, state: 'success', message: 'Added to stock' } : row));
      } catch (error) {
        if (requestGeneration !== generation.current) break;
        failureCount++;
        setFiles(current => current.map(row => row.id === item.id ? { ...row, state: 'error', message: error instanceof Error ? error.message : 'Upload failed.' } : row));
      }
    }
    setUploading(false); busyRef.current = false;
    if (requestGeneration !== generation.current) return;
    if (requestGeneration === generation.current) {
      try {
        const refreshed = await guarded(session.accessToken, signal => voucherAdminApi.rewards(session.accessToken, signal));
        if (refreshed) setRewards(refreshed);
      } catch (error) { setAuthMessage(error instanceof Error ? error.message : 'Could not refresh stock; reload the catalog to confirm the final count.'); }
    }
    setNotice(`${successCount} unique barcode${successCount === 1 ? '' : 's'} added to stock${failureCount ? `; ${failureCount} failed and can be retried explicitly` : ''}. Stock refreshed from GreenPoint.`);
  };

  const selectedReward = useMemo(() => rewards.find(reward => reward._id === selectedRewardId), [rewards, selectedRewardId]);
  const uploadReady = Boolean(session && files.some(file => file.state === 'queued' || file.state === 'error') && form.name.trim() && form.partnerId);

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      {mobile ? null : <DashboardSidebar activeRoute="vouchers" onNavigate={onNavigate} />}
      <View style={[s.main, mobile && s.mainMobile]}>
        <DashboardTopNav title="Vouchers" subtitle="Create rewards and issue unique barcode vouchers" />
        <ScrollView style={s.scroll} contentContainerStyle={[s.content, compact && s.contentCompact]} showsVerticalScrollIndicator={false}>
          {mobile ? <View style={s.mobileHeading}><TouchableOpacity accessibilityRole="button" accessibilityLabel="Return to Dashboard" onPress={() => onNavigate('dashboard')} style={s.backButton}><Text style={s.backText}>‹  Dashboard</Text></TouchableOpacity><Text style={s.mobileTitle}>Vouchers</Text></View> : null}
          <View style={[s.hero, compact && s.heroCompact]}>
            <View style={s.heroIcon}><TicketPercent size={22} color="#156B2F" /></View>
            <View style={s.heroCopy}><Text style={s.eyebrow}>GREENPOINT REWARDS</Text><Text style={s.heroTitle}>Voucher stock, managed clearly.</Text><Text style={s.heroBody}>Create an offer, then upload one unique code image per redeemable voucher.</Text></View>
            {session ? <TouchableOpacity onPress={() => { void loadCatalog(session); }} style={s.iconButton}><RefreshCw size={16} color="#156B2F" /><Text style={s.iconButtonText}>Refresh stock</Text></TouchableOpacity> : null}
          </View>

          {!session ? <View style={s.loginCard}>
            <View style={s.sectionHeading}><View style={s.headingIcon}><ShieldCheck size={18} color="#156B2F" /></View><View style={{ flex: 1 }}><Text style={s.sectionTitle}>Administrator sign in</Text><Text style={s.muted}>Use your GreenPoint phone number and password.</Text></View></View>
            {forbidden ? <View style={s.warningBox}><CircleAlert size={17} color="#A65A00" /><Text style={s.warningText}>{authMessage}</Text></View> : authMessage ? <View style={s.errorBox}><CircleAlert size={17} color="#B42318" /><Text style={s.errorText}>{authMessage}</Text></View> : null}
            <View style={[s.loginFields, compact && s.stack]}>
              <View style={s.field}><Text style={s.label}>Phone number</Text><TextInput accessibilityLabel="Admin phone number" value={loginPhone} onChangeText={setLoginPhone} autoComplete="tel" keyboardType="phone-pad" placeholder="Enter admin phone number" style={s.input} editable={!loginBusy} /></View>
              <View style={s.field}><Text style={s.label}>Password</Text><TextInput accessibilityLabel="Admin password" value={loginPassword} onChangeText={setLoginPassword} secureTextEntry autoComplete="current-password" placeholder="Enter password" style={s.input} editable={!loginBusy} onSubmitEditing={() => void signIn()} /></View>
              <TouchableOpacity disabled={loginBusy || !loginPhone.trim() || !loginPassword} onPress={() => void signIn()} style={[s.primaryButton, (loginBusy || !loginPhone.trim() || !loginPassword) && s.buttonDisabled]}>{loginBusy ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryButtonText}>Verify admin</Text>}</TouchableOpacity>
            </View>
            <Text style={s.authHint}>{sessionChecked ? 'Voucher management connects directly to GreenPoint and requires an administrator account.' : 'Checking for an active administrator session…'}</Text>
          </View> : <>
            <View style={s.sessionBar}><View style={s.sessionIdentity}><BadgeCheck size={16} color="#156B2F" /><Text style={s.sessionText}>Admin session · {session.displayName}</Text></View><TouchableOpacity onPress={signOut} style={s.signOut}><LogOut size={15} color="#516551" /><Text style={s.signOutText}>Sign out</Text></TouchableOpacity></View>
            <View style={[s.columns, compact && s.stack]}>
              <View style={[s.editorCard, !compact && s.leftColumn, (loading || saving || uploading) && s.interactionDisabled]}>
                <View style={s.sectionHeading}><View style={s.step}><Text style={s.stepText}>01</Text></View><View style={{ flex: 1 }}><Text style={s.sectionTitle}>Reward details</Text><Text style={s.muted}>Offers use the same GreenPoint catalog and points balance.</Text></View></View>
                {loading ? <View style={s.loading}><ActivityIndicator color="#156B2F" /><Text style={s.muted}>Loading rewards and partners…</Text></View> : <>
                  <Text style={s.label}>Offer</Text>
                  <View style={s.optionsRow}>{[{ id: 'new', name: '＋  Create new offer' }, ...rewards.map(r => ({ id: r._id, name: `${r.name} · ${r.quantityRemaining ?? 0} available` }))].map(item => <TouchableOpacity accessibilityRole="button" accessibilityLabel={item.id === 'new' ? 'Create a new reward offer' : `Edit ${item.name}`} key={item.id} onPress={() => selectExisting(item.id)} style={[s.option, item.id === selectedRewardId && s.optionSelected]}><Text style={[s.optionText, item.id === selectedRewardId && s.optionTextSelected]} numberOfLines={1}>{item.name}</Text></TouchableOpacity>)}</View>
                  <View style={[s.row, compact && s.stack]}>
                    <View style={[s.field, { flex: 1.5 }]}><Text style={s.label}>Partner</Text><View style={s.optionsRow}>{partners.map(partner => <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Set partner to ${partner.name}`} accessibilityState={{ selected: partner._id === form.partnerId }} key={partner._id} onPress={() => setForm(f => ({ ...f, partnerId: partner._id }))} style={[s.option, partner._id === form.partnerId && s.optionSelected]}><Text style={[s.optionText, partner._id === form.partnerId && s.optionTextSelected]}>{partner.name}</Text></TouchableOpacity>)}</View></View>
                    <View style={[s.field, { flex: 1 }]}><Text style={s.label}>Add partner</Text><View style={s.inlineCreate}><TextInput accessibilityLabel="New partner name" value={partnerName} onChangeText={setPartnerName} placeholder="Partner name" style={[s.input, { flex: 1 }]} /><TouchableOpacity accessibilityRole="button" accessibilityLabel="Create partner" disabled={!partnerName.trim()} onPress={() => void ensurePartner()} style={[s.smallAction, !partnerName.trim() && s.buttonDisabled]}><Plus size={16} color="#fff" /></TouchableOpacity></View></View>
                  </View>
                  <View style={s.field}><Text style={s.label}>Offer name</Text><TextInput accessibilityLabel="Offer name" value={form.name} onChangeText={v => setForm(f => ({ ...f, name: v }))} placeholder="e.g. 20% off at Green Café" style={s.input} /></View>
                  <View style={s.field}><Text style={s.label}>Description</Text><TextInput accessibilityLabel="Offer description" value={form.description} onChangeText={v => setForm(f => ({ ...f, description: v }))} placeholder="What customers receive" style={[s.input, s.multiline]} multiline /></View>
                  <View style={[s.row, compact && s.stack]}>
                    <View style={[s.field, { flex: 1 }]}><Text style={s.label}>Points required</Text><TextInput accessibilityLabel="Points required" value={form.pointsRequired} onChangeText={v => setForm(f => ({ ...f, pointsRequired: v.replace(/[^\d]/g, '') }))} keyboardType="number-pad" placeholder="500" style={s.input} /></View>
                    <View style={[s.field, { flex: 1 }]}><Text style={s.label}>Expiry date <Text style={s.optional}>(optional)</Text></Text><TextInput accessibilityLabel="Expiry date in YYYY-MM-DD format" value={form.validUntil} onChangeText={v => setForm(f => ({ ...f, validUntil: v }))} placeholder="YYYY-MM-DD" style={s.input} />{selectedReward?.validUntil ? <Text style={s.muted}>Existing expiry cannot be cleared through this API.</Text> : null}</View>
                  </View>
                  <View style={s.field}><Text style={s.label}>Reward type</Text><View style={s.optionsRow}>{REWARD_TYPES.map(type => <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Reward type ${type}`} accessibilityState={{ selected: type === form.rewardType }} key={type} onPress={() => setForm(f => ({ ...f, rewardType: type }))} style={[s.option, type === form.rewardType && s.optionSelected]}><Text style={[s.optionText, type === form.rewardType && s.optionTextSelected]}>{type.replace('_', ' ')}</Text></TouchableOpacity>)}</View></View>
                  <View style={s.field}><Text style={s.label}>Terms and conditions <Text style={s.optional}>(one per line)</Text></Text><TextInput accessibilityLabel="Terms and conditions, one per line" value={form.terms} onChangeText={v => setForm(f => ({ ...f, terms: v }))} placeholder="Valid at participating locations" style={[s.input, s.multiline, { minHeight: 72 }]} multiline /></View>
                  <View style={s.field}><Text style={s.label}>Catalog artwork URL <Text style={s.optional}>(optional, public offer artwork)</Text></Text><TextInput accessibilityLabel="Public catalog artwork URL" value={form.imageUrl} onChangeText={v => setForm(f => ({ ...f, imageUrl: v }))} placeholder="https://…" style={s.input} autoCapitalize="none" />{selectedReward?.imageUrl ? <Text style={s.muted}>Existing artwork cannot be cleared through this API.</Text> : null}</View>
                  {selectedRewardId !== 'new' ? <View style={s.statusRow}><Text style={s.statusLabel}>Catalog status · {form.status}</Text><TouchableOpacity disabled={saving || uploading} accessibilityRole="button" onPress={() => void saveReward(form.status === 'active' ? 'inactive' : 'active')} style={s.statusAction}><Text style={s.statusActionText}>{form.status === 'active' ? 'Pause listing' : 'Activate listing'}</Text></TouchableOpacity></View> : null}
                  <TouchableOpacity disabled={loading || saving || uploading} onPress={() => void saveReward()} style={[s.secondaryButton, (loading || saving || uploading) && s.buttonDisabled]}>{saving ? <ActivityIndicator color="#156B2F" /> : <Text style={s.secondaryButtonText}>{selectedRewardId === 'new' ? 'Save offer to Rewards' : 'Save offer changes'}</Text>}</TouchableOpacity>
                </>}
              </View>

              <View style={[s.stockCard, !compact && s.rightColumn]}>
                <View style={s.sectionHeading}><View style={s.step}><Text style={s.stepText}>02</Text></View><View style={{ flex: 1 }}><Text style={s.sectionTitle}>Unique barcode stock</Text><Text style={s.muted}>Every accepted image creates one voucher.</Text></View></View>
                {selectedReward ? <View style={s.stockOverview}><View><Text style={s.stockLabel}>AVAILABLE</Text><Text style={s.stockValue}>{selectedReward.quantityRemaining ?? 0}</Text></View><View style={s.stockDivider} /><View><Text style={s.stockLabel}>UPLOADED TOTAL</Text><Text style={s.stockValue}>{selectedReward.quantityTotal ?? 0}</Text></View></View> : <View style={s.tipBox}><Text style={s.tipText}>Save the offer details first. Stock will reflect each unique image accepted by GreenPoint.</Text></View>}
                <VoucherFilePicker disabled={loading || saving || uploading} onFiles={addFiles} />
                {files.length ? <View style={s.fileList}>
                  <View style={s.queueHeader}><Text style={s.queueTitle}>Upload queue · {files.length}/20</Text>{files.some(file => file.state === 'success') ? <TouchableOpacity disabled={uploading || saving} onPress={clearCompleted}><Text style={s.clearCompleted}>Clear completed</Text></TouchableOpacity> : <Text style={s.queueHint}>Preview contained inside the card</Text>}</View>
                  {files.map(file => <View key={file.id} style={s.fileRow}>
                    <View style={s.previewFrame}><Image source={{ uri: file.preview }} style={s.previewImage} resizeMode="contain" /></View>
                    <View style={s.fileMeta}><Text style={s.fileName} numberOfLines={1}>{file.file.name}</Text><Text style={s.fileSize}>{(file.file.size / 1024).toFixed(0)} KB · {file.state === 'success' ? 'Added to stock' : file.state === 'uploading' ? 'Uploading…' : file.state === 'error' ? file.message : 'Ready to upload'}</Text></View>
                    {(file.state === 'queued' || file.state === 'error') ? <TouchableOpacity disabled={saving || uploading} onPress={() => removeFile(file)} style={s.removeBtn}><Trash2 size={15} color="#667566" /></TouchableOpacity> : file.state === 'success' ? <BadgeCheck size={18} color="#156B2F" /> : <ActivityIndicator size="small" color="#156B2F" />}
                  </View>)}
                </View> : null}
                <View style={s.noticeRow}><ShieldCheck size={16} color="#52764C" /><Text style={s.noticeCopy}>Uploaded barcode files are stored as private voucher codes. The public reward card uses catalog artwork only.</Text></View>
                <TouchableOpacity disabled={!uploadReady || loading || saving || uploading} onPress={() => void uploadBatch()} style={[s.primaryButton, (!uploadReady || loading || saving || uploading) && s.buttonDisabled]}>{uploading ? <ActivityIndicator color="#fff" /> : <><UploadCloud size={16} color="#fff" /><Text style={s.primaryButtonText}>{files.some(file => file.state === 'error') ? 'Retry failed uploads' : 'Upload voucher codes'}</Text></>}</TouchableOpacity>
              </View>
            </View>
            {notice ? <View style={notice.includes('failed') || notice.includes('skipped') || notice.includes('already') ? s.warningBox : s.successBox}><Text style={notice.includes('failed') || notice.includes('skipped') || notice.includes('already') ? s.warningText : s.successText}>{notice}</Text></View> : null}
            {authMessage ? <View style={s.errorBox}><Text style={s.errorText}>{authMessage}</Text></View> : null}
          </>}
          <Text style={s.footer}>Voucher codes are never shown in the public rewards catalog. Stock is sourced from the GreenPoint admin API.</Text>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F7FAF4' }, main: { flex: 1, marginLeft: SIDEBAR_WIDTH }, mainMobile: { marginLeft: 0 }, scroll: { flex: 1 }, content: { padding: 24, gap: 18, maxWidth: 1440, width: '100%', alignSelf: 'center' }, contentCompact: { padding: 14, gap: 12 }, mobileHeading: { gap: 5, paddingTop: 2 }, backButton: { alignSelf: 'flex-start', paddingVertical: 5 }, backText: { color: '#416342', fontWeight: '700', fontSize: 12 }, mobileTitle: { color: '#203322', fontSize: 22, fontWeight: '800' },
  hero: { backgroundColor: '#EAF3E5', borderRadius: 20, padding: 22, flexDirection: 'row', alignItems: 'center', gap: 16, borderWidth: 1, borderColor: '#DCEBD5' }, heroCompact: { alignItems: 'flex-start', flexWrap: 'wrap', padding: 17 }, heroIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }, heroCopy: { flex: 1, minWidth: 200 }, eyebrow: { color: '#5C7D4D', fontSize: 10, fontWeight: '800', letterSpacing: 1.4 }, heroTitle: { color: '#18361D', fontSize: 22, fontWeight: '800', marginTop: 4 }, heroBody: { color: '#61745D', fontSize: 13, marginTop: 5, lineHeight: 19 }, iconButton: { flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1, borderColor: '#C9DEC0', borderRadius: 14, backgroundColor: '#FFF', paddingHorizontal: 14, minHeight: 44 }, iconButtonText: { color: '#156B2F', fontWeight: '700', fontSize: 12 },
  loginCard: { backgroundColor: '#FFF', borderRadius: 20, borderWidth: 1, borderColor: '#E3EADF', padding: 24, gap: 16, maxWidth: 780, width: '100%', alignSelf: 'center', shadowColor: '#1B3B1B', shadowOpacity: 0.04, shadowRadius: 16, shadowOffset: { width: 0, height: 5 }, elevation: 2 }, loginFields: { flexDirection: 'row', gap: 12, alignItems: 'flex-end' }, stack: { flexDirection: 'column', alignItems: 'stretch' }, authHint: { color: '#849182', fontSize: 11 }, interactionDisabled: { pointerEvents: 'none' },
  sessionBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4 }, sessionIdentity: { flexDirection: 'row', alignItems: 'center', gap: 8 }, sessionText: { color: '#526450', fontSize: 12, fontWeight: '700' }, signOut: { flexDirection: 'row', gap: 6, alignItems: 'center', padding: 8 }, signOutText: { color: '#516551', fontWeight: '600', fontSize: 12 }, columns: { flexDirection: 'row', gap: 16, alignItems: 'flex-start' }, leftColumn: { flex: 1.15 }, rightColumn: { flex: 0.85 }, editorCard: { backgroundColor: '#FFF', borderRadius: 20, borderWidth: 1, borderColor: '#E3EADF', padding: 20, gap: 14, shadowColor: '#1B3B1B', shadowOpacity: 0.035, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 1 }, stockCard: { backgroundColor: '#FFF', borderRadius: 20, borderWidth: 1, borderColor: '#E3EADF', padding: 20, gap: 14, shadowColor: '#1B3B1B', shadowOpacity: 0.035, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 1 }, sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 3 }, headingIcon: { width: 38, height: 38, borderRadius: 13, backgroundColor: '#EAF3E5', alignItems: 'center', justifyContent: 'center' }, step: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#EAF3E5', alignItems: 'center', justifyContent: 'center' }, stepText: { color: '#156B2F', fontWeight: '800', fontSize: 12 }, sectionTitle: { color: '#203322', fontSize: 16, fontWeight: '800' }, muted: { color: '#788675', fontSize: 11, marginTop: 3 },
  field: { gap: 6, minWidth: 0 }, row: { flexDirection: 'row', gap: 11 }, label: { color: '#465544', fontWeight: '700', fontSize: 11 }, optional: { color: '#899587', fontWeight: '400' }, input: { minHeight: 44, borderWidth: 1, borderColor: '#DFE6DC', borderRadius: 12, backgroundColor: '#FCFDFC', paddingHorizontal: 12, color: '#1B2D1C', fontSize: 13 }, multiline: { minHeight: 66, paddingTop: 11, textAlignVertical: 'top' }, readonly: { color: '#63715F', backgroundColor: '#F7F9F6' }, inlineCreate: { flexDirection: 'row', gap: 6 }, smallAction: { width: 44, minHeight: 44, borderRadius: 12, backgroundColor: '#156B2F', alignItems: 'center', justifyContent: 'center' }, selectWrap: { minHeight: 44, position: 'relative' }, selectIcon: { position: 'absolute', right: 13, top: 10, zIndex: 3, color: '#6B7E6A' }, selectInput: { borderWidth: 1, borderColor: '#DFE6DC', borderRadius: 12, backgroundColor: '#FCFDFC', height: 44, paddingHorizontal: 12, color: '#1B2D1C' }, optionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 7 }, option: { borderWidth: 1, borderColor: '#E3EADF', borderRadius: 10, paddingVertical: 7, paddingHorizontal: 9, maxWidth: '100%' }, optionSelected: { backgroundColor: '#EAF3E5', borderColor: '#BAD5AE' }, optionText: { color: '#526450', fontSize: 11 }, optionTextSelected: { color: '#156B2F', fontWeight: '700' }, selectNative: { minWidth: 0 },
  primaryButton: { minHeight: 52, borderRadius: 15, backgroundColor: '#156B2F', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, paddingHorizontal: 16 }, primaryButtonText: { color: '#FFF', fontSize: 13, fontWeight: '800' }, secondaryButton: { minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: '#B9D2B0', backgroundColor: '#F6FAF3', alignItems: 'center', justifyContent: 'center' }, secondaryButtonText: { color: '#156B2F', fontSize: 12, fontWeight: '800' }, buttonDisabled: { opacity: 0.52 }, loading: { minHeight: 160, alignItems: 'center', justifyContent: 'center', gap: 9 },
  stockOverview: { flexDirection: 'row', alignItems: 'center', borderRadius: 15, backgroundColor: '#F7FAF4', paddingVertical: 13, paddingHorizontal: 17, gap: 18 }, stockLabel: { color: '#7B8877', fontSize: 9, fontWeight: '800', letterSpacing: 1 }, stockValue: { color: '#1B3B1B', fontSize: 22, fontWeight: '800', marginTop: 3 }, stockDivider: { height: 38, width: 1, backgroundColor: '#DDE7D8' }, tipBox: { padding: 13, borderRadius: 13, backgroundColor: '#F7FAF4' }, tipText: { color: '#64755F', fontSize: 12, lineHeight: 18 }, statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, backgroundColor: '#F7FAF4', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 }, statusLabel: { fontSize: 11, color: '#5D6E59', fontWeight: '700', textTransform: 'capitalize' }, statusAction: { paddingVertical: 8, paddingHorizontal: 10, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#D8E5D1', borderRadius: 10 }, statusActionText: { color: '#156B2F', fontSize: 11, fontWeight: '800' }, fileList: { gap: 8 }, queueHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }, queueTitle: { color: '#344834', fontSize: 12, fontWeight: '800' }, clearCompleted: { color: '#156B2F', fontSize: 10, fontWeight: '700', padding: 4 }, queueHint: { color: '#91A08E', fontSize: 10 }, fileRow: { flexDirection: 'row', alignItems: 'center', padding: 8, borderWidth: 1, borderColor: '#E9EEE6', borderRadius: 13, gap: 10 }, previewFrame: { width: 62, height: 48, borderRadius: 8, borderWidth: 1, borderColor: '#E7EAE5', backgroundColor: '#FFF', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }, previewImage: { width: 58, height: 44 }, fileMeta: { flex: 1, minWidth: 0 }, fileName: { color: '#304130', fontSize: 11, fontWeight: '700' }, fileSize: { color: '#7B8877', fontSize: 10, marginTop: 3 }, removeBtn: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F2F5F0' }, noticeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 11, backgroundColor: '#F5F8F2', borderRadius: 12 }, noticeCopy: { flex: 1, color: '#667763', fontSize: 10, lineHeight: 15 },
  successBox: { backgroundColor: '#ECF6E9', borderRadius: 12, padding: 13 }, successText: { color: '#28582C', fontSize: 12, lineHeight: 18 }, warningBox: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', padding: 12, borderRadius: 12, backgroundColor: '#FFF7E8' }, warningText: { flex: 1, color: '#865000', fontSize: 12, lineHeight: 17 }, errorBox: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', padding: 12, borderRadius: 12, backgroundColor: '#FFF1F0' }, errorText: { flex: 1, color: '#9D2922', fontSize: 12, lineHeight: 17 }, footer: { color: '#8A9687', textAlign: 'center', fontSize: 10, paddingBottom: 10 },
});
