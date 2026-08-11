import React, { useState, useEffect, useRef } from 'react';
import { useOutletContext, Link, useSearchParams } from 'react-router-dom';
import { db } from '@/api/supabaseClient';
import { useAuth } from '@/lib/AuthContext';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import SEO from '@/components/SEO';
import { toast } from 'sonner';
import { useAutosave, AutosaveIndicator } from '@/hooks/useAutosave.jsx';
import {
  User, Bell, Sun, Moon, Briefcase, Wallet,
  Camera, Loader2, X, Upload, Plus,
  GraduationCap, Globe, ExternalLink, Eye, CheckCircle, AlertCircle,
  Facebook, Linkedin, Youtube, Twitter, Link as LinkIcon,
  Smartphone,
} from 'lucide-react';

// Refresh SDK axios Authorization header from the latest token in localStorage.
// appParams.token is frozen at module-load time; this keeps uploads/saves working
// for sessions created after the initial page load (e.g. post-registration flow).
function ensureSdkToken() {
  const t = window.localStorage.getItem('aca_access_token') || window.localStorage.getItem('token');
  if (t) db.auth.setToken(t);
}

/* ─────────────────────────────────────────────────────────────────────────────
   Helpers
───────────────────────────────────────────────────────────────────────────── */
function slugify(str) {
  return str.toLowerCase().trim().replace(/[^a-z0-9]+/, '-').replace(/^-|-$/g, '');
}

const ALL_SUBJECTS = [
  'Biology', 'Chemistry', 'Physics', 'Mathematics', 'Additional Mathematics',
  'English Language', 'English Literature', 'Chichewa', 'Agriculture',
  'Geography', 'History',
];

/* ─────────────────────────────────────────────────────────────────────────────
   PhotoUploader — shared by profile photo (topbar avatar) AND tutor cover photo
───────────────────────────────────────────────────────────────────────────── */
function PhotoUploader({ value, onChange, size = 24, label = 'Photo', hint = 'JPG, PNG or WebP · max 5 MB' }) {
  const inputRef = useRef();
  const [uploading, setUploading] = useState(false);
  const [localPreview, setLocalPreview] = useState(null);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Please select an image file'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be under 5 MB'); return; }

    const objectUrl = URL.createObjectURL(file);
    setLocalPreview(objectUrl);
    setUploading(true);
    try {
      ensureSdkToken();
      const { file_url } = await db.integrations.Core.UploadFile({ file });
      onChange(file_url);
      toast.success('Photo uploaded!');
    } catch {
      toast.error('Upload failed — please try again.');
      setLocalPreview(null);
    } finally {
      setUploading(false);
    }
  };

  const displaySrc = localPreview || value || null;
  const sz = `w-${size} h-${size}`;

  return (
    <div className="flex items-center gap-4">
      <div className={`relative flex-shrink-0 cursor-pointer group ${sz} rounded-full overflow-hidden border-2 border-dashed border-border bg-muted flex items-center justify-center shadow-sm`}
        onClick={() => inputRef.current?.click()}>
        {displaySrc
          ? <img src={displaySrc} alt={label} className="w-full h-full object-cover" />
          : <div className="flex flex-col items-center gap-1 text-muted-foreground">
              <Camera className="w-7 h-7" />
              <span className="text-[10px] font-medium">Add Photo</span>
            </div>
        }
        <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          {uploading ? <Loader2 className="w-5 h-5 text-white animate-spin" /> : <Camera className="w-5 h-5 text-white" />}
        </div>
        {uploading && <div className="absolute inset-0 rounded-full border-2 border-primary border-t-transparent animate-spin" />}
      </div>

      <div className="flex flex-col gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={uploading} className="gap-2">
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {uploading ? 'Uploading…' : displaySrc ? 'Change Photo' : 'Upload Photo'}
        </Button>
        {displaySrc && !uploading && (
          <button type="button" onClick={() => { setLocalPreview(null); onChange(''); }}
            className="text-xs text-muted-foreground hover:text-destructive transition-colors text-left">
            Remove photo
          </button>
        )}
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      </div>

      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden" onChange={handleFile} onClick={e => { e.target.value = ''; }} />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Main component
───────────────────────────────────────────────────────────────────────────── */


export default function TeacherSettings() {
  const { user } = useOutletContext() ?? {};
  const queryClient = useQueryClient();
  const { checkUserAuth } = useAuth();

  /* ── Account state ── */
  const [fullName,       setFullName]       = useState('');
  const [phone,          setPhone]          = useState('');
  const [avatarPreview,  setAvatarPreview]  = useState('');
  const [avatarUploading,setAvatarUploading]= useState(false);
  const avatarInputRef = useRef(null);
  const [profileSaving,  setProfileSaving]  = useState(false);

  /* ── Payout state ── */
  const [airtelMoney, setAirtelMoney] = useState('');
  const [tnmMpamba,   setTnmMpamba]   = useState('');
  const [bankName,    setBankName]    = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [payoutSaving,setPayoutSaving]= useState(false);

  /* ── Notifications ── */
  const [notifAssignments,  setNotifAssignments]  = useState(true);
  const [notifStudents,     setNotifStudents]     = useState(true);
  const [notifAnnouncements,setNotifAnnouncements]= useState(true);

  /* ── Appearance ── */
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');

  /* ── Tutor profile state ── */
  const EMPTY_PROFILE = {
    full_name: '', slug: '', professional_title: '', tagline: '',
    biography: '', years_teaching: '', previous_schools: '', current_position: '',
    profile_photo: '', cover_photo: '', subjects: [],
    qualifications: [], certifications: [],
    email: '', phone: '', whatsapp: '',
    facebook: '', linkedin: '', youtube: '', twitter_x: '', tiktok: '',
    is_visible: true,
  };
  const [profile,     setProfileData] = useState(null);  // saved TutorProfile record
  const [form,        setForm]        = useState(EMPTY_PROFILE);
  const [qualInput,   setQualInput]   = useState({ name: '', institution: '', year: '' });
  const [certInput,   setCertInput]   = useState({ name: '', organization: '', date_issued: '' });
  const [isSaving,    setIsSaving]    = useState(false);
  const [saveError,   setSaveError]   = useState(null);

  /* ── Fetch existing TutorProfile ── */
  const { data: profiles = [], isLoading: profileLoading } = useQuery({
    queryKey: ['my-tutor-profile', user?.id],
    queryFn:  () => db.entities.TutorProfile.filter({ user_id: user.id }, 'full_name', 1),
    enabled: !!user?.id,
    staleTime: 0,
  });

  /* ── Init account fields (once per user session — prevents autosave loop) ── */
  const accountInitialised = useRef(false);
  useEffect(() => {
    if (user && !accountInitialised.current) {
      accountInitialised.current = true;
      setFullName(user.full_name || '');
      setAvatarPreview(user.avatar_url || '');
      setPhone(user.phone_number || '');
      setAirtelMoney(user.airtel_money || '');
      setTnmMpamba(user.tnm_mpamba || '');
      setBankName(user.bank_name || '');
      setBankAccount(user.bank_account || '');
    }
  }, [user?.id]);

  /* ── Init tutor profile fields ── */
  useEffect(() => {
    const p = profiles[0] || null;
    setProfileData(p);
    if (p) {
      setForm({
        full_name:          p.full_name          || '',
        slug:               p.slug               || '',
        professional_title: p.professional_title || '',
        tagline:            p.tagline            || '',
        biography:          p.biography          || '',
        years_teaching:     p.years_teaching     || '',
        previous_schools:   p.previous_schools   || '',
        current_position:   p.current_position   || '',
        profile_photo:      p.profile_photo      || '',
        cover_photo:        p.cover_photo        || '',
        subjects:           p.subjects           || [],
        qualifications:     p.qualifications     || [],
        certifications:     p.certifications     || [],
        email:              p.email              || user?.email || '',
        phone:              p.phone              || '',
        whatsapp:           p.whatsapp           || '',
        facebook:           p.facebook           || '',
        linkedin:           p.linkedin           || '',
        youtube:            p.youtube            || '',
        twitter_x:          p.twitter_x          || '',
        tiktok:             p.tiktok             || '',
        is_visible:         p.is_visible !== false,
      });
    } else if (user) {
      setForm(prev => ({
        ...prev,
        full_name: user.full_name || '',
        slug:      slugify(user.full_name || ''),
        email:     user.email || '',
      }));
    }
  }, [profiles.length > 0 ? profiles[0]?.id : null, user?.id]);

  /* ── Helpers ── */
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const toggleSubject = s => set('subjects', form.subjects.includes(s)
    ? form.subjects.filter(x => x !== s)
    : [...form.subjects, s]
  );
  const addQual = () => {
    if (!qualInput.name.trim()) return;
    set('qualifications', [...(form.qualifications || []), { ...qualInput }]);
    setQualInput({ name: '', institution: '', year: '' });
  };
  const addCert = () => {
    if (!certInput.name.trim()) return;
    set('certifications', [...(form.certifications || []), { ...certInput }]);
    setCertInput({ name: '', organization: '', date_issued: '' });
  };

  const handleTheme = (t) => {
    setTheme(t);
    localStorage.setItem('theme', t);
    document.documentElement.classList.toggle('dark', t === 'dark');
  };

  /* ── Avatar upload (topbar photo) ── */
  const handleAvatarFile = async (e) => {
    ensureSdkToken();
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarPreview(URL.createObjectURL(file));
    setAvatarUploading(true);
    try {
      const { file_url } = await db.integrations.Core.UploadFile({ file });
      setAvatarPreview(file_url);
      await db.auth.updateMe({ avatar_url: file_url });
      toast.success('Profile photo updated!');
    } catch {
      toast.error('Upload failed — please try again.');
      setAvatarPreview(user?.avatar_url || '');
    } finally {
      setAvatarUploading(false);
    }
  };

  const removeAvatar = async () => {
    setAvatarPreview('');
    await db.auth.updateMe({ avatar_url: '' });
    toast.success('Profile photo removed');
  };

  /* ── Save account (name, phone, avatar) ── */
  const saveAccount = async () => {
    ensureSdkToken();
    setProfileSaving(true);
    try {
      await db.auth.updateMe({ full_name: fullName.trim(), phone_number: phone });
      toast.success('Account saved!');
    } catch { toast.error('Could not save account'); }
    finally { setProfileSaving(false); }
  };

  /* Account autosave */
  const { saveStatus: accountSaveStatus } = useAutosave(saveAccount, [fullName, phone, avatarPreview]);

  /* ── Save payout ── */
  const savePayout = async () => {
    setPayoutSaving(true);
    try {
      await db.auth.updateMe({ airtel_money: airtelMoney, tnm_mpamba: tnmMpamba, bank_name: bankName, bank_account: bankAccount });
      toast.success('Payout details saved!');
    } catch { toast.error('Could not save payout details'); }
    finally { setPayoutSaving(false); }
  };

  /* Payout autosave */
  const { saveStatus: payoutSaveStatus } = useAutosave(savePayout, [airtelMoney, tnmMpamba, bankName, bankAccount]);

  /* ── Save tutor profile ── */
  const saveTutorProfile = async () => {
    ensureSdkToken();
    if (!form.full_name.trim()) { toast.error('Full name is required'); return; }
    if (!form.slug.trim())      { toast.error('Profile URL slug is required'); return; }
    setSaveError(null);
    setIsSaving(true);
    try {
      const payload = {
        ...form,
        years_teaching: form.years_teaching !== '' ? Number(form.years_teaching) : null,
        user_id: user.id,
        status: 'active',
      };
      if (profile?.id) {
        await db.entities.TutorProfile.update(profile.id, payload);
      } else {
        await db.entities.TutorProfile.create(payload);
      }
      await queryClient.invalidateQueries({ queryKey: ['my-tutor-profile', user?.id] });
      toast.success('Public profile saved!');
    } catch (err) {
      const msg = err?.message || String(err);
      setSaveError(msg);
      toast.error('Could not save profile — ' + msg);
    } finally {
      setIsSaving(false);
    }
  };

  const initial = (user?.full_name || user?.email || 'T')[0].toUpperCase();

  // Deep-link: ?tab=public-profile navigates directly to that tab
  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get('tab') || 'account';

  /* Tutor profile autosave - watch main form fields */
  const { saveStatus: tutorSaveStatus } = useAutosave(saveTutorProfile, [
    form.headline, form.bio, form.experience_years, form.education_level,
  ], { delay: 2000 });

  /* ─────────────────────────────────────────────────────────────────────────
     RENDER
  ───────────────────────────────────────────────────────────────────────── */
  return (
    <>
      <SEO title="Teacher Settings" description="Manage your account and public tutor profile" />

      <div className="space-y-6 max-w-3xl">
        <div>
          <h1 className="text-2xl font-heading font-bold">Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your account, public tutor profile, payout details, and preferences
          </p>
        </div>

        <Tabs defaultValue={defaultTab}>
          <TabsList className="bg-muted w-full justify-start flex-wrap h-auto gap-1 p-1">
            <TabsTrigger value="account"        className="gap-1.5"><User className="w-3.5 h-3.5" />Account</TabsTrigger>
            <TabsTrigger value="public-profile" className="gap-1.5"><GraduationCap className="w-3.5 h-3.5" />Public Profile</TabsTrigger>
            <TabsTrigger value="payout"         className="gap-1.5"><Wallet className="w-3.5 h-3.5" />Payout</TabsTrigger>
            <TabsTrigger value="notifications"  className="gap-1.5"><Bell className="w-3.5 h-3.5" />Notifications</TabsTrigger>
            <TabsTrigger value="appearance"     className="gap-1.5"><Sun className="w-3.5 h-3.5" />Appearance</TabsTrigger>
          </TabsList>

          {/* ══════════════════════════════════════════════════════════════════
              TAB: ACCOUNT
          ══════════════════════════════════════════════════════════════════ */}
          <TabsContent value="account" className="mt-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Account Information</CardTitle></CardHeader>
              <CardContent className="space-y-5">

                {/* Profile photo (topbar avatar) */}
                <div>
                  <Label className="mb-2 block text-sm font-medium">Profile Photo
                    <span className="ml-2 text-xs text-muted-foreground font-normal">— shows in the top bar, forums, and discussions</span>
                  </Label>
                  <div className="flex items-center gap-4">
                    <div className="relative flex-shrink-0">
                      {avatarPreview ? (
                        <img src={avatarPreview} alt="Profile"
                          className="w-20 h-20 rounded-full object-cover border-2 border-border" />
                      ) : (
                        <div className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold border-2 border-border"
                          style={{ background:'hsl(var(--primary))', color:'hsl(var(--primary-foreground))' }}>
                          {initial}
                        </div>
                      )}
                      {avatarUploading && (
                        <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
                          <Loader2 className="w-6 h-6 text-white animate-spin" />
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <Button type="button" variant="outline" size="sm"
                          onClick={() => avatarInputRef.current?.click()} disabled={avatarUploading}>
                          <Camera className="w-3.5 h-3.5 mr-1.5" />
                          {avatarPreview ? 'Change' : 'Upload'} Photo
                        </Button>
                        {avatarPreview && (
                          <Button type="button" variant="ghost" size="sm"
                            onClick={removeAvatar} className="text-destructive">
                            <X className="w-3.5 h-3.5 mr-1" /> Remove
                          </Button>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">JPG, PNG or WebP · max 5 MB</p>
                      <input ref={avatarInputRef} type="file" accept="image/*"
                        className="hidden" onChange={handleAvatarFile} />
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Full Name</Label>
                  <Input value={fullName} onChange={e => setFullName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Email Address</Label>
                  <Input value={user?.email || ''} disabled className="opacity-60" />
                  <p className="text-xs text-muted-foreground">Email cannot be changed here.</p>
                </div>
                <div className="space-y-1.5">
                  <Label>Phone Number</Label>
                  <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+265 XXX XXX XXX" />
                </div>
                <Button onClick={saveAccount} disabled={profileSaving}>
                  {profileSaving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving…</> : 'Save Changes'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ══════════════════════════════════════════════════════════════════
              TAB: PUBLIC PROFILE  (full TutorProfile editor, merged in)
          ══════════════════════════════════════════════════════════════════ */}
          <TabsContent value="public-profile" className="mt-4">
            <div className="space-y-4">

              {/* Status bar */}
              <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-card">
                <div className="flex items-center gap-2.5">
                  <div className={`w-2 h-2 rounded-full ${form.is_visible ? 'bg-emerald-500' : 'bg-muted-foreground'}`} />
                  <span className="text-sm font-medium">
                    {form.is_visible ? 'Visible to students in the tutor directory' : 'Hidden from the tutor directory'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {profile?.slug && (
                    <a href={`/tutors/${profile.slug}`} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs text-primary hover:underline">
                      <ExternalLink className="w-3.5 h-3.5" /> View live
                    </a>
                  )}
                  <button
                    onClick={() => set('is_visible', !form.is_visible)}
                    className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                      form.is_visible
                        ? 'border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10'
                        : 'border-border text-muted-foreground hover:border-primary/40'
                    }`}
                  >
                    {form.is_visible ? 'Hide' : 'Make visible'}
                  </button>
                </div>
              </div>

              {saveError && (
                <div className="flex items-start gap-3 p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-sm text-destructive">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" /> {saveError}
                </div>
              )}

              {/* Nested tabs for profile sections */}
              <Tabs defaultValue="basic">
                <TabsList className="bg-muted w-full justify-start flex-wrap h-auto gap-1 p-1">
                  <TabsTrigger value="basic"          className="gap-1.5"><User className="w-3.5 h-3.5" />Basic Info</TabsTrigger>
                  <TabsTrigger value="qualifications" className="gap-1.5"><GraduationCap className="w-3.5 h-3.5" />Qualifications</TabsTrigger>
                  <TabsTrigger value="experience"     className="gap-1.5"><Briefcase className="w-3.5 h-3.5" />Experience</TabsTrigger>
                  <TabsTrigger value="contact"        className="gap-1.5"><Globe className="w-3.5 h-3.5" />Contact & Social</TabsTrigger>
                </TabsList>

                {/* ── Basic Info ── */}
                <TabsContent value="basic" className="mt-3">
                  <div className="bg-card border border-border rounded-2xl p-5 space-y-5">

                    <div>
                      <Label className="mb-2 block">Profile Photo
                        <span className="ml-2 text-xs text-muted-foreground font-normal">— shown on your public tutor card and profile page</span>
                      </Label>
                      <PhotoUploader value={form.profile_photo} onChange={v => set('profile_photo', v)} size={24} />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2">
                        <Label>Display Name *</Label>
                        <Input className="mt-1" value={form.full_name}
                          onChange={e => { set('full_name', e.target.value); if (!profile) set('slug', slugify(e.target.value)); }}
                          placeholder="Your full name as shown to students" />
                      </div>
                      <div className="col-span-2">
                        <Label>Profile URL *</Label>
                        <div className="flex items-center gap-0 mt-1">
                          <span className="text-xs text-muted-foreground whitespace-nowrap bg-muted px-2.5 py-2 rounded-l-xl border border-r-0 border-border">/tutors/</span>
                          <Input value={form.slug} onChange={e => set('slug', slugify(e.target.value))}
                            className="rounded-l-none font-mono text-sm" placeholder="your-name" />
                        </div>
                        {form.slug && <p className="text-xs text-primary/70 mt-1">Live at: aca.db.app/tutors/{form.slug}</p>}
                      </div>
                      <div className="col-span-2">
                        <Label>Professional Title</Label>
                        <Input className="mt-1" value={form.professional_title}
                          onChange={e => set('professional_title', e.target.value)}
                          placeholder="e.g. Senior Biology Tutor" />
                      </div>
                      <div className="col-span-2">
                        <Label>Tagline <span className="text-xs text-muted-foreground font-normal">(shown on your directory card)</span></Label>
                        <Input className="mt-1" value={form.tagline}
                          onChange={e => set('tagline', e.target.value)}
                          placeholder="e.g. Making Science Simple" maxLength={100} />
                      </div>
                    </div>

                    <div>
                      <Label>Biography</Label>
                      <Textarea className="mt-1" value={form.biography}
                        onChange={e => set('biography', e.target.value)} rows={6}
                        placeholder="Tell students about yourself — your background, teaching philosophy, and what makes you passionate about education..." />
                    </div>

                    <div>
                      <Label className="mb-3 block">Subjects You Teach</Label>
                      <div className="flex flex-wrap gap-2">
                        {ALL_SUBJECTS.map(s => (
                          <button type="button" key={s} onClick={() => toggleSubject(s)}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                              form.subjects.includes(s)
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'bg-background text-muted-foreground border-border hover:border-primary/40 hover:text-foreground'
                            }`}>
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </TabsContent>

                {/* ── Qualifications ── */}
                <TabsContent value="qualifications" className="mt-3">
                  <div className="bg-card border border-border rounded-2xl p-5 space-y-5">
                    <div>
                      <h3 className="font-semibold mb-3">Academic Qualifications</h3>
                      <div className="space-y-2 mb-4">
                        {(form.qualifications || []).map((q, i) => (
                          <div key={i} className="flex items-start justify-between gap-3 bg-muted/40 rounded-xl p-3">
                            <div>
                              <p className="text-sm font-medium">{q.name}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">{q.institution}{q.year && ` · ${q.year}`}</p>
                            </div>
                            <button onClick={() => set('qualifications', form.qualifications.filter((_, j) => j !== i))}
                              className="text-muted-foreground hover:text-destructive transition-colors mt-0.5 flex-shrink-0">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                        {form.qualifications?.length === 0 && (
                          <p className="text-xs text-muted-foreground py-2">No qualifications added yet.</p>
                        )}
                      </div>
                      <div className="grid grid-cols-7 gap-2 items-end">
                        <div className="col-span-3">
                          <Label className="text-xs">Qualification</Label>
                          <Input value={qualInput.name} onChange={e => setQualInput(p => ({ ...p, name: e.target.value }))}
                            className="mt-1 h-9 text-sm" placeholder="e.g. BSc Biology" onKeyDown={e => e.key === 'Enter' && addQual()} />
                        </div>
                        <div className="col-span-2">
                          <Label className="text-xs">Institution</Label>
                          <Input value={qualInput.institution} onChange={e => setQualInput(p => ({ ...p, institution: e.target.value }))}
                            className="mt-1 h-9 text-sm" placeholder="University" onKeyDown={e => e.key === 'Enter' && addQual()} />
                        </div>
                        <div className="col-span-1">
                          <Label className="text-xs">Year</Label>
                          <Input value={qualInput.year} onChange={e => setQualInput(p => ({ ...p, year: e.target.value }))}
                            className="mt-1 h-9 text-sm" placeholder="2024" onKeyDown={e => e.key === 'Enter' && addQual()} />
                        </div>
                        <div className="col-span-1">
                          <Button type="button" size="sm" variant="outline" onClick={addQual} className="w-full h-9"><Plus className="w-4 h-4" /></Button>
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-border pt-5">
                      <h3 className="font-semibold mb-3">Professional Certifications</h3>
                      <div className="space-y-2 mb-4">
                        {(form.certifications || []).map((c, i) => (
                          <div key={i} className="flex items-start justify-between gap-3 bg-muted/40 rounded-xl p-3">
                            <div>
                              <p className="text-sm font-medium">{c.name}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">{c.organization}{c.date_issued && ` · ${c.date_issued}`}</p>
                            </div>
                            <button onClick={() => set('certifications', form.certifications.filter((_, j) => j !== i))}
                              className="text-muted-foreground hover:text-destructive transition-colors mt-0.5 flex-shrink-0">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                        {form.certifications?.length === 0 && (
                          <p className="text-xs text-muted-foreground py-2">No certifications added yet.</p>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-2 items-end">
                        <div>
                          <Label className="text-xs">Certificate</Label>
                          <Input value={certInput.name} onChange={e => setCertInput(p => ({ ...p, name: e.target.value }))}
                            className="mt-1 h-9 text-sm" onKeyDown={e => e.key === 'Enter' && addCert()} />
                        </div>
                        <div>
                          <Label className="text-xs">Organization</Label>
                          <Input value={certInput.organization} onChange={e => setCertInput(p => ({ ...p, organization: e.target.value }))}
                            className="mt-1 h-9 text-sm" onKeyDown={e => e.key === 'Enter' && addCert()} />
                        </div>
                        <div>
                          <Label className="text-xs">Date Issued</Label>
                          <Input value={certInput.date_issued} onChange={e => setCertInput(p => ({ ...p, date_issued: e.target.value }))}
                            className="mt-1 h-9 text-sm" placeholder="Jan 2024" onKeyDown={e => e.key === 'Enter' && addCert()} />
                        </div>
                      </div>
                      <Button type="button" variant="outline" size="sm" onClick={addCert} className="w-full mt-3 gap-2">
                        <Plus className="w-4 h-4" /> Add Certification
                      </Button>
                    </div>
                  </div>
                </TabsContent>

                {/* ── Experience ── */}
                <TabsContent value="experience" className="mt-3">
                  <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Years Teaching</Label>
                        <Input type="number" min={0} value={form.years_teaching}
                          onChange={e => set('years_teaching', e.target.value)} className="mt-1" placeholder="0" />
                      </div>
                      <div>
                        <Label>Current Position</Label>
                        <Input value={form.current_position}
                          onChange={e => set('current_position', e.target.value)} className="mt-1"
                          placeholder="e.g. Tutor at Chibondo Academy" />
                      </div>
                      <div className="col-span-2">
                        <Label>Previous Schools / Institutions</Label>
                        <Textarea value={form.previous_schools}
                          onChange={e => set('previous_schools', e.target.value)} rows={3} className="mt-1"
                          placeholder="List schools or institutions you've taught at previously..." />
                      </div>
                    </div>
                  </div>
                </TabsContent>

                {/* ── Contact & Social ── */}
                <TabsContent value="contact" className="mt-3">
                  <div className="bg-card border border-border rounded-2xl p-5 space-y-5">
                    <div>
                      <h3 className="font-semibold mb-1">Contact Info</h3>
                      <p className="text-xs text-muted-foreground mb-4">Optional — only shown if you choose to include it on your profile</p>
                      <div className="grid grid-cols-2 gap-4">
                        <div><Label>Email</Label><Input type="email" value={form.email} onChange={e => set('email', e.target.value)} className="mt-1" /></div>
                        <div><Label>Phone</Label><Input value={form.phone} onChange={e => set('phone', e.target.value)} className="mt-1" /></div>
                        <div className="col-span-2"><Label>WhatsApp</Label><Input value={form.whatsapp} onChange={e => set('whatsapp', e.target.value)} className="mt-1" placeholder="+265 99 000 0000" /></div>
                      </div>
                    </div>
                    <div className="border-t border-border pt-5">
                      <h3 className="font-semibold mb-4">Social Links</h3>
                      <div className="space-y-3">
                        {[
                          { key: 'facebook',  label: 'Facebook',    icon: Facebook,  placeholder: 'https://facebook.com/yourpage' },
                          { key: 'linkedin',  label: 'LinkedIn',    icon: Linkedin,  placeholder: 'https://linkedin.com/in/yourname' },
                          { key: 'youtube',   label: 'YouTube',     icon: Youtube,   placeholder: 'https://youtube.com/@yourchannel' },
                          { key: 'twitter_x', label: 'X / Twitter', icon: Twitter,   placeholder: 'https://x.com/yourhandle' },
                          { key: 'tiktok',    label: 'TikTok',      icon: LinkIcon,  placeholder: 'https://tiktok.com/@yourhandle' },
                        ].map(({ key, label, icon: Icon, placeholder }) => (
                          <div key={key} className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                              <Icon className="w-4 h-4 text-muted-foreground" />
                            </div>
                            <div className="flex-1">
                              <Label className="text-xs text-muted-foreground">{label}</Label>
                              <Input value={form[key]} onChange={e => set(key, e.target.value)}
                                placeholder={placeholder} className="mt-0.5 text-sm h-9" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              {/* Public profile save button */}
              <div className="flex justify-end gap-3 pb-2">
                <Button onClick={saveTutorProfile} disabled={isSaving} size="lg" className="gap-2">
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  {isSaving ? 'Saving…' : 'Save Public Profile'}
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* ══════════════════════════════════════════════════════════════════
              TAB: PAYOUT
          ══════════════════════════════════════════════════════════════════ */}
          <TabsContent value="payout" className="mt-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Payout Details</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <p className="text-xs text-muted-foreground">Enter the mobile money or bank details where your earnings should be sent.</p>
                <div className="space-y-1.5">
                  <Label>Airtel Money Number</Label>
                  <Input value={airtelMoney} onChange={e => setAirtelMoney(e.target.value)} placeholder="+265 99 XXX XXXX" />
                </div>
                <div className="space-y-1.5">
                  <Label>TNM Mpamba Number</Label>
                  <Input value={tnmMpamba} onChange={e => setTnmMpamba(e.target.value)} placeholder="+265 88 XXX XXXX" />
                </div>
                <div className="space-y-1.5">
                  <Label>Bank Name</Label>
                  <Input value={bankName} onChange={e => setBankName(e.target.value)} placeholder="e.g. National Bank" />
                </div>
                <div className="space-y-1.5">
                  <Label>Bank Account Number</Label>
                  <Input value={bankAccount} onChange={e => setBankAccount(e.target.value)} placeholder="Account number" />
                </div>
                <Button onClick={savePayout} disabled={payoutSaving}>
                  {payoutSaving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving…</> : 'Save Payout Details'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ══════════════════════════════════════════════════════════════════
              TAB: NOTIFICATIONS
          ══════════════════════════════════════════════════════════════════ */}
          <TabsContent value="notifications" className="mt-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Notification Preferences</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {/* Push Notifications */}
                {[
                  { label: 'New Assignments', desc: 'When a student submits an assignment', value: notifAssignments, onChange: setNotifAssignments },
                  { label: 'New Students',    desc: 'When a student enrols in your course', value: notifStudents,    onChange: setNotifStudents },
                  { label: 'Announcements',   desc: 'Platform-wide announcements',           value: notifAnnouncements, onChange: setNotifAnnouncements },
                ].map(n => (
                  <div key={n.label} className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium">{n.label}</p>
                      <p className="text-xs text-muted-foreground">{n.desc}</p>
                    </div>
                    <Switch checked={n.value} onCheckedChange={n.onChange} />
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ══════════════════════════════════════════════════════════════════
              TAB: APPEARANCE
          ══════════════════════════════════════════════════════════════════ */}
          <TabsContent value="appearance" className="mt-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Appearance</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm font-medium">Theme</p>
                <div className="flex gap-3">
                  {[
                    { t: 'light', label: 'Light', icon: Sun },
                    { t: 'dark',  label: 'Dark',  icon: Moon },
                  ].map(({ t, label, icon: Icon }) => (
                    <button key={t} onClick={() => handleTheme(t)}
                      className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border transition-all text-sm font-medium ${
                        theme === t ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/40'
                      }`}>
                      <Icon className="w-4 h-4" /> {label}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
