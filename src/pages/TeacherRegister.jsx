import React, { useState } from "react";
import { Link } from "react-router-dom";
import { db } from '@/api/supabaseClient';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Mail, Lock, Phone, Loader2, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import AuthLayout from "@/components/AuthLayout";

const SUBJECTS = [
  "English", "Chichewa", "Mathematics", "Biology", "Agriculture",
  "Chemistry", "Physics", "History", "Geography",
  "Bible Knowledge", "Computer Studies", "Home Economics", "Social Studies",
];

export default function TeacherRegister() {
  const [step, setStep] = useState("form"); // "form" | "done"
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [subjects, setSubjects] = useState([]);
  const [qualifications, setQualifications] = useState("");
  const [school, setSchool] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const toggleSubject = (s) =>
    setSubjects(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) { setError("Passwords do not match"); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
    setLoading(true);
    try {
      // Register account — no OTP gate
      const result = await db.auth.register({ email: email.trim(), password, full_name: fullName.trim() });
      if (result?.access_token) {
        await db.auth.setToken(result.access_token);
      }

      // Get the newly created user
      const me = await db.auth.me();

      // Create the teacher application record
      await db.entities.TeacherApplication.create({
        full_name: fullName.trim(),
        email: email.trim(),
        phone_number: phone.trim(),
        subjects,
        qualifications: qualifications.trim(),
        school_or_institution: school.trim(),
        status: "pending",
        user_id: me?.id || "",
      });

      // Update name on profile
      try { await db.auth.updateMe({ full_name: fullName.trim() }); } catch (_) {}

      setStep("done");
    } catch (err) {
      setError(err.message || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (step === "done") {
    return (
      <AuthLayout title="Application Submitted!" subtitle="We'll review your application soon">
        <div className="text-center space-y-6 py-6">
          <div className="flex justify-center">
            <div className="w-20 h-20 rounded-full bg-success/15 flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-success" />
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Your teacher application has been received. Our team will review it and get back to you within 2–3 business days.
            </p>
          </div>
          <Link to="/login">
            <Button className="w-full h-12">Back to Login</Button>
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Apply as a Teacher"
      subtitle="Join the Chibondo Academy teaching team"
      footer={
        <div>
          Already have an account?{" "}
          <Link to="/login" className="text-primary font-medium hover:underline">Sign in</Link>
        </div>
      }
    >
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Full Name */}
        <div className="space-y-2">
          <Label htmlFor="fullName">Full Name <span className="text-red-500">*</span></Label>
          <Input
            id="fullName"
            autoFocus
            placeholder="Your full name"
            value={fullName}
            onChange={e => setFullName(e.target.value)}
            className="h-12"
            required
          />
        </div>

        {/* Email */}
        <div className="space-y-2">
          <Label htmlFor="email">Email Address <span className="text-red-500">*</span></Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="pl-10 h-12"
              required
            />
          </div>
        </div>

        {/* Phone */}
        <div className="space-y-2">
          <Label htmlFor="phone">Phone Number</Label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="phone"
              type="tel"
              placeholder="+265 xxx xxx xxx"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              className="pl-10 h-12"
            />
          </div>
        </div>

        {/* Password */}
        <div className="space-y-2">
          <Label htmlFor="password">Password <span className="text-red-500">*</span></Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="At least 6 characters"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="pl-10 pr-10 h-12"
              required
            />
            <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Confirm Password */}
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm Password <span className="text-red-500">*</span></Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="confirmPassword"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Repeat your password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              className="pl-10 h-12"
              required
            />
          </div>
        </div>

        {/* Subjects */}
        <div className="space-y-2">
          <Label>Subjects You Teach <span className="text-red-500">*</span></Label>
          <div className="flex flex-wrap gap-2">
            {SUBJECTS.map(s => (
              <button
                key={s}
                type="button"
                onClick={() => toggleSubject(s)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  subjects.includes(s)
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted text-muted-foreground border-border hover:border-primary/40"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Qualifications */}
        <div className="space-y-2">
          <Label htmlFor="qualifications">Qualifications</Label>
          <Textarea
            id="qualifications"
            placeholder="e.g. BEd Mathematics, University of Malawi"
            value={qualifications}
            onChange={e => setQualifications(e.target.value)}
            rows={2}
          />
        </div>

        {/* School */}
        <div className="space-y-2">
          <Label htmlFor="school">School or Institution</Label>
          <Input
            id="school"
            placeholder="Where do you currently teach?"
            value={school}
            onChange={e => setSchool(e.target.value)}
            className="h-12"
          />
        </div>

        <Button type="submit" className="w-full h-12 font-semibold" disabled={loading || subjects.length === 0}>
          {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Submitting...</> : "Submit Application"}
        </Button>
      </form>
    </AuthLayout>
  );
}
