import React, { useState } from 'react';
import { UserPlus, Mail, Lock, User, Briefcase, ArrowLeft, CheckCircle2, MapPin, Building, CreditCard, ShieldCheck, Phone, FileText, Calendar, Award, AlertCircle, HeartPulse, Globe, Upload, File, Image, Trash2, Eye, Camera, Zap } from 'lucide-react';
import { supabase } from '../services/supabase';
import { pinToAuthPassword } from '../utils/pinAuth';
import { useTranslation } from "react-i18next";

interface RegisterProps {
    onNavigate: (page: string) => void;
}

type Lang = 'bm' | 'en' | 'zh';

const Register: React.FC<RegisterProps> = ({ onNavigate }) => {
    const { t } = useTranslation();
    // ── Language State ──
    const [lang, setLang] = useState<Lang>('bm');

    // ── Form Steps ──
    const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);

    // ── Section 1: Personal Particulars (Maklumat Peribadi - JTK) ──
    const [avatarFile, setAvatarFile] = useState<string | null>(null);
    const [avatarName, setAvatarName] = useState<string>('');
    const [name, setName] = useState('');
    const [icType, setIcType] = useState<'MyKad' | 'Passport'>('MyKad');
    const [icNumber, setIcNumber] = useState('');
    const [gender, setGender] = useState<string>('Lelaki / Male');
    const [dob, setDob] = useState('');
    const [race, setRace] = useState('Melayu');
    const [religion, setReligion] = useState('Islam');
    const [maritalStatus, setMaritalStatus] = useState('Bujang / Single');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [address, setAddress] = useState('');
    const [postcode, setPostcode] = useState('');
    const [state, setState] = useState('Perak');

    // ── Document Uploads State ──
    const [icDocFile, setIcDocFile] = useState<string | null>(null);
    const [icDocName, setIcDocName] = useState<string>('');
    const [licenseDocFile, setLicenseDocFile] = useState<string | null>(null);
    const [licenseDocName, setLicenseDocName] = useState<string>('');
    const [resumeDocFile, setResumeDocFile] = useState<string | null>(null);
    const [resumeDocName, setResumeDocName] = useState<string>('');

    // ── Section 2: Position & Factory (Jawatan & Kilang) ──
    const [baseLocation, setBaseLocation] = useState<'Taiping' | 'Nilai' | 'Kelantan' | 'Johor'>('Taiping');
    const [appliedRole, setAppliedRole] = useState('Operator');
    const [licenseClass, setLicenseClass] = useState('Tiada / None');
    const [licenseExpiry, setLicenseExpiry] = useState('');
    const [education, setEducation] = useState('SPM');
    const [experienceYears, setExperienceYears] = useState('0');

    // ── Section 3: Statutory & Financial (KWSP, PERKESO, Bank) ──
    const [bankName, setBankName] = useState('Maybank');
    const [bankAcc, setBankAcc] = useState('');
    const [epfNo, setEpfNo] = useState('');
    const [socsoNo, setSocsoNo] = useState('');
    const [taxNo, setTaxNo] = useState('');

    // ── Section 4: Emergency Contact & Security PIN ──
    const [emergencyName, setEmergencyName] = useState('');
    const [emergencyRelation, setEmergencyRelation] = useState('Ibu/Bapa (Parent)');
    const [emergencyPhone, setEmergencyPhone] = useState('');
    const [password, setPassword] = useState(''); // 4-digit PIN
    const [healthConditions, setHealthConditions] = useState('Sihat / Healthy');
    const [declaration, setDeclaration] = useState(false);

    // ── Foreign Worker Bypass Mode ──
    const isForeignWorker = icType === 'Passport' || race === 'Pekerja Asing (Foreigner)';

    // ── Status State ──
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [errorMsg, setErrorMsg] = useState('');
    const [appRefNo, setAppRefNo] = useState('');

    // ── File Helper ──
    const handleFileRead = (e: React.ChangeEvent<HTMLInputElement>, setFile: (val: string | null) => void, setName?: (val: string) => void) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            alert(lang === 'zh' ? t('File size cannot exceed 5MB!') : (lang === 'en' ? 'File size must not exceed 5MB!' : 'Saiz fail tidak boleh melebihi 5MB!'));
            return;
        }

        if (setName) setName(file.name);
        const reader = new FileReader();
        reader.onloadend = () => {
            setFile(reader.result as string);
        };
        reader.readAsDataURL(file);
    };

    // ── Translation Dictionary ──
    const localT = {
        bm: {
            title: 'BORANG PERMOHONAN PEKERJA & TEMUDUGA',
            subtitle: 'Pendaftaran Jawatan Kumpulan Packsecure OS • Akta Kerja 1955',
            badge: 'JTK MALAYSIA COMPLIANT • AKTA KERJA 1955',
            step1: '1. Peribadi & Dokumen',
            step2: '2. Jawatan',
            step3: '3. Caruman',
            step4: '4. Waris & PIN',
            sec1Title: 'Section 1: Maklumat Pemohon, Gambar Profil & Dokumen',
            uploadAvatar: 'Muat Naik Gambar Profil / Pasport (Profile Photo)',
            avatarTip: 'Klik untuk muat naik gambar saiz pasport atau foto swafoto jelas.',
            fullName: 'Nama Penuh (Seperti Dalam IC / Pasport) *',
            icDocType: 'Jenis Dokumen Pengenalan *',
            mykad: 'MyKad (Warganegara)',
            passport: 'Pasport (Bukan Warganegara)',
            icNumber: 'No. Kad Pengenalan / Pasport *',
            gender: 'Jantina (Gender) *',
            dob: 'Tarikh Lahir (Date of Birth)',
            race: 'Bangsa (Race)',
            marital: 'Status Perkahwinan (Marital Status)',
            phone: 'No. Telefon Bimbit (Phone / WhatsApp) *',
            email: 'Alamat Emel (Email - Opsional)',
            address: 'Alamat Kediaman Penuh (Residential Address)',
            uploadIc: 'Muat Naik Salinan IC / Pasport (Gambar / PDF)',
            uploadLicense: 'Muat Naik Salinan Lesen Memandu (Opsional / Lori)',
            uploadResume: 'Muat Naik Resume / Sijil (Opsional)',
            chooseFile: 'Pilih Fail (Choose File)',
            uploaded: 'Fail Diberjaya Dimuat Naik',
            nextTo2: 'Seterusnya: Jawatan (Step 2) →',
            sec2Title: 'Section 2: Permohonan Jawatan & Kilang (Position & Location)',
            prefLocation: 'Kilang Pilihan (Preferred Base Location) *',
            roleApplied: 'Jawatan Dipohon (Position Applied) *',
            education: 'Kelayakan Akademik (Education)',
            license: 'Kelas Lesen Memandu (Driving License)',
            licenseExp: 'Tarikh Luput Lesen (License Expiry)',
            back: '← Kembali',
            nextTo3: 'Seterusnya: Caruman & Bank (Step 3) →',
            sec3Title: 'Section 3: Maklumat Bank & Caruman Wajib (Bank & Statutory)',
            bankName: 'Nama Bank Pembayaran Gaji *',
            bankAcc: 'Nombor Akaun Bank *',
            epf: 'No. Ahli KWSP (EPF Account No.)',
            socso: 'No. Pendaftaran PERKESO (SOCSO)',
            nextTo4: 'Seterusnya: Waris & PIN (Step 4) →',
            sec4Title: 'Section 4: Waris Kecemasan & PIN Masuk (Emergency Contact & PIN)',
            emergName: 'Nama Waris Kecemasan (Emergency Contact) *',
            emergRelation: 'Hubungan Waris (Relationship)',
            emergPhone: 'No. Telefon Waris (Emergency Phone) *',
            pinCode: 'Cipta PIN 4-Digit Masuk App (4-Digit PIN) *',
            pinTip: t('PIN ini akan digunakan untuk Punch Card Punch & Log Masuk Harian. (Default: 1234)'),
            health: 'Pengakuan Kesihatan (Health Conditions)',
            declarationText: 'Pengakuan Pemohon (Akta Kerja 1955): Saya mengaku bahawa semua maklumat yang dinyatakan dalam borang permohonan ini adalah benar dan sahih.',
            submitBtn: 'HANTAR PERMOHONAN TEMUDUGA / SUBMIT APPLICATION',
            submitting: 'MENGHANTAR PERMOHONAN...',
            successTitle: 'Permohonan Berjaya Dihantar / Application Submitted',
            successMsg: 'Permohonan anda dan dokumen lampiran telah didaftarkan ke dalam sistem HR Packsecure OS. Sila maklumkan kepada Pegawai Sumber Manusia (HR) untuk kelulusan akaun.',
            returnLogin: 'Kembali ke Halaman Log Masuk'
        },
        en: {
            title: 'STAFF JOB APPLICATION & INTERVIEW FORM',
            subtitle: 'Packsecure OS Group Employment Application • Malaysia Employment Act 1955',
            badge: 'JTK MALAYSIA COMPLIANT • EMPLOYMENT ACT 1955',
            step1: '1. Personal & Photo',
            step2: '2. Position & Base',
            step3: '3. Bank & Statutory',
            step4: '4. Emergency & PIN',
            sec1Title: 'Section 1: Applicant Personal Particulars & Profile Photo Upload',
            uploadAvatar: 'Upload Passport-Size Profile Photo',
            avatarTip: 'Click to upload a clear passport photo or selfie.',
            fullName: 'Full Name (As per IC / Passport) *',
            icDocType: 'Identity Document Type *',
            mykad: 'MyKad (Malaysian Citizen)',
            passport: 'Passport (Foreign Worker)',
            icNumber: 'MyKad / Passport Number *',
            gender: 'Gender *',
            dob: 'Date of Birth',
            race: 'Race / Ethnicity',
            marital: 'Marital Status',
            phone: 'Mobile Phone / WhatsApp Number *',
            email: 'Email Address (Optional)',
            address: 'Full Residential Address',
            uploadIc: 'Upload IC / Passport Copy (Photo or PDF)',
            uploadLicense: 'Upload Driving License Copy (Optional / Drivers)',
            uploadResume: 'Upload Resume / Certificates (Optional)',
            chooseFile: 'Choose File',
            uploaded: 'File Uploaded Successfully',
            nextTo2: 'Next: Position & Location (Step 2) →',
            sec2Title: 'Section 2: Applied Position & Factory Base',
            prefLocation: 'Preferred Base Location / Factory *',
            roleApplied: 'Position Applied *',
            education: 'Educational Attainment',
            license: 'Driving License Class',
            licenseExp: 'License Expiry Date',
            back: '← Back',
            nextTo3: 'Next: Banking & Statutory (Step 3) →',
            sec3Title: 'Section 3: Bank Account & Statutory Contributions',
            bankName: 'Salary Payment Bank *',
            bankAcc: 'Bank Account Number *',
            epf: 'EPF (KWSP) Account Number',
            socso: 'SOCSO (PERKESO) Registration Number',
            nextTo4: 'Next: Emergency Contact & PIN (Step 4) →',
            sec4Title: 'Section 4: Emergency Contact Person & Security PIN',
            emergName: 'Emergency Contact Person Name *',
            emergRelation: 'Relationship to Applicant',
            emergPhone: 'Emergency Contact Phone Number *',
            pinCode: 'Create 4-Digit Security PIN *',
            pinTip: 'This 4-digit PIN is used for daily clock-in (Punch Card) and App Login. (Default: 1234)',
            health: 'Health Condition Declaration',
            declarationText: 'Applicant Declaration (Employment Act 1955): I hereby confirm and declare that all information provided in this application form is true and accurate.',
            submitBtn: 'SUBMIT APPLICATION & INTERVIEW FORM',
            submitting: 'SUBMITTING APPLICATION...',
            successTitle: 'Job Application Successfully Submitted',
            successMsg: 'Your job application and attached documents have been registered into the Packsecure OS HR System. Please inform HR for profile approval.',
            returnLogin: 'Return to Login Page'
        },
        zh: {
            title: t('Employee application and interview forms'),
            subtitle: t('Packsecure OS Group Employee Onboarding and Interview Application Form • Compliant with the Labor Act 1955'),
            badge: t('Comply with Malaysian Ministry of Labor (JTK) statutory standards'),
            step1: t('1. Personal information and avatar'),
            step2: t('2. Position and factory area'),
            step3: t('3. Banks and Provident Funds'),
            step4: t('4. Emergency contact and PIN'),
            sec1Title: t('Part 1: Upload the applicant’s personal information and avatar (Personal & Profile Photo)'),
            uploadAvatar: t('Upload personal ID photo/avatar photo (Passport Photo)'),
            avatarTip: t('Click to upload a clear personal ID photo or a self-portrait of the front.'),
            fullName: t('Real full name (must be consistent with ID card/passport)*'),
            icDocType: t('Document type *'),
            mykad: t('MyKad ID Card (Malaysian Citizens)'),
            passport: t('Passport (foreign employees)'),
            icNumber: t('ID/passport number *'),
            gender: t('gender *'),
            dob: t('date of birth'),
            race: t('Race'),
            marital: t('Marital status'),
            phone: t('Mobile number/WhatsApp*'),
            email: t('Email (optional)'),
            address: t('Current address'),
            uploadIc: t('Upload ID/Passport Photo or PDF (IC/Passport Photo)'),
            uploadLicense: t('Upload driver’s license photo (required/optional for drivers)'),
            uploadResume: t('Upload resume/graduation certificate (optional)'),
            chooseFile: t('Choose File'),
            uploaded: t('File uploaded successfully'),
            nextTo2: t('Next step: Position and factory area (Step 2) →'),
            sec2Title: t('Part 2: Position & Location'),
            prefLocation: t('Preferred Base *'),
            roleApplied: t('Position Applied *'),
            education: t('Highest academic qualification'),
            license: t('Driving license type'),
            licenseExp: t('Driver\'s license expiry date'),
            back: t('← Return to previous step'),
            nextTo3: t('Next step: Banks and provident funds (Step 3) →'),
            sec3Title: t('Part 3: Payroll Bank and Legal Caruman Account Number'),
            bankName: t('Payroll bank name *'),
            bankAcc: t('Bank card account number *'),
            epf: t('Provident Fund (KWSP/EPF) account number'),
            socso: t('Social Security (SOCSO/PERKESO) Account Number'),
            nextTo4: t('Next step: Emergency contact and PIN (Step 4) →'),
            sec4Title: t('Part 4: Emergency Contacts and 4-Digit Login PIN'),
            emergName: t('Emergency contact name *'),
            emergRelation: t('Relationship with the applicant'),
            emergPhone: t('Emergency contact number *'),
            pinCode: t('Set a 4-digit App Check-in/Login PIN*'),
            pinTip: t('This 4-digit PIN will be used to clock in and out each day and to quickly log in to the app. (Default for foreign employees: 1234)'),
            health: t('health statement'),
            declarationText: t('Applicant\'s Statutory Declaration (Labor Act 1955): I hereby declare that all the information filled in this form and the documents uploaded are true and valid. If there is any falsehood, the company has the right to revoke the application.'),
            submitBtn: t('Submit application and interview application form'),
            submitting: t('Submitting application and documents...'),
            successTitle: t('Application and documents submitted successfully!'),
            successMsg: t('Your interview application form, headshot photo and accompanying documents have been successfully registered in the Packsecure OS Group HR system. Please contact the HR manager to review and activate your account.'),
            returnLogin: t('Return to login page')
        }
    }[lang];

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setStatus('loading');
        setErrorMsg('');

        // ⚡ Foreign Worker Auto-fill & Bypass Logic
        const finalName = name.trim() || (isForeignWorker ? 'PEKERJA ASING / FOREIGN WORKER' : '');
        let cleanIc = icNumber.replace(/[^a-zA-Z0-9]/g, '');
        if (!cleanIc && isForeignWorker) {
            cleanIc = `FW${Date.now().toString().slice(-8)}`;
        }

        const finalPhone = phone.trim() || (isForeignWorker ? '000000000' : '');
        const finalBankAcc = bankAcc.trim() || (isForeignWorker ? 'PENDING' : '');
        const finalEmergencyName = emergencyName.trim() || (isForeignWorker ? 'N/A' : '');
        const finalEmergencyPhone = emergencyPhone.trim() || (isForeignWorker ? '000000000' : '');

        let pinDigits = password.replace(/\D/g, '');
        if (isForeignWorker && pinDigits.length !== 4) {
            pinDigits = '1234'; // Default PIN for foreign workers
        }

        if (!isForeignWorker && !declaration) {
            setErrorMsg(lang === 'zh' ? t('Please tick the statutory declaration at the bottom.') : (lang === 'en' ? 'Please agree to the self-declaration.' : 'Sila tandakan pengakuan sah di bahagian bawah.'));
            setStatus('error');
            return;
        }

        if (!isForeignWorker && pinDigits.length !== 4) {
            setErrorMsg(lang === 'zh' ? t('PIN must be exactly 4 digits') : t('PIN must be exactly 4 digits'));
            setStatus('error');
            return;
        }

        if (!cleanIc) {
            setErrorMsg(lang === 'zh' ? t('Please enter your ID card or passport number') : 'Sila masukkan No. Kad Pengenalan / Pasport.');
            setStatus('error');
            return;
        }

        // Fail-safe email generation if blank
        const finalEmail = email.trim() 
            ? email.trim().toLowerCase() 
            : `${cleanIc.toLowerCase()}@applicant.packsecure.com`;

        try {
            // Automatically append "00" to 4-digit PIN for Supabase Auth requirement
            const finalPassword = pinToAuthPassword(pinDigits);
            const generatedRef = `JTK-${Date.now().toString().slice(-6)}`;
            setAppRefNo(generatedRef);

            // 1. Sign Up with Supabase Auth (Store all JTK Metadata & Avatar & Document Attachments)
            const { data: signUpData, error: authError } = await supabase.auth.signUp({
                email: finalEmail,
                password: finalPassword,
                options: {
                    data: {
                        full_name: finalName,
                        ic_number: cleanIc,
                        ic_type: icType,
                        phone: finalPhone,
                        base_location: baseLocation,
                        role: appliedRole,
                        gender,
                        dob,
                        race,
                        religion,
                        marital_status: maritalStatus,
                        address: `${address.trim()} ${postcode.trim()} ${state}`.trim(),
                        bank_name: bankName,
                        bank_acc: finalBankAcc,
                        epf_no: epfNo.trim(),
                        socso_no: socsoNo.trim() || cleanIc,
                        emergency_name: finalEmergencyName,
                        emergency_relation: emergencyRelation,
                        emergency_phone: finalEmergencyPhone,
                        license_class: licenseClass,
                        license_expiry: licenseExpiry,
                        education,
                        experience_years: experienceYears,
                        health_conditions: healthConditions,
                        employee_id: pinDigits,
                        application_ref: generatedRef,
                        avatar_url: avatarFile,
                        is_foreign_worker: isForeignWorker,
                        documents: {
                            ic_doc_name: icDocName,
                            ic_doc_file: icDocFile,
                            license_doc_name: licenseDocName,
                            license_doc_file: licenseDocFile,
                            resume_doc_name: resumeDocName,
                            resume_doc_file: resumeDocFile
                        }
                    }
                }
            });

            if (authError) {
                if (authError.message.toLowerCase().includes('already registered')) {
                    throw new Error(lang === 'zh' ? t('An application has been submitted for this ID card/email address ({{var0}}), please contact the HR manager.', { var0: finalEmail }) : `No. IC / Emel (${finalEmail}) telah didaftarkan. Sila hubungi Admin/HR.`);
                }
                throw authError;
            }

            const registeredUid = signUpData.user?.id;
            if (registeredUid) {
                // Insert Pending user record to users_public for HR Portal approval
                try {
                    await supabase.from('users_public').upsert({
                        id: registeredUid,
                        email: finalEmail,
                        name: finalName,
                        employee_id: pinDigits,
                        role: appliedRole,
                        status: 'Pending',
                        base_location: baseLocation
                    });
                } catch (err) {
                    console.warn("users_public pending insert warning:", err);
                }

                // Insert Pending user record to sys_users_v2
                try {
                    await supabase.from('sys_users_v2').upsert({
                        auth_user_id: registeredUid,
                        email: finalEmail,
                        name: finalName,
                        employee_id: pinDigits,
                        pin_code: pinDigits,
                        phone: finalPhone,
                        role: appliedRole,
                        status: 'Pending'
                    }, { onConflict: 'auth_user_id' });
                } catch (err) {
                    console.warn("sys_users_v2 pending insert warning:", err);
                }
            }

            setStatus('success');
        } catch (err: any) {
            console.error("Registration Error:", err);
            setErrorMsg(err.message || "Pendaftaran gagal. Sila cuba lagi.");
            setStatus('error');
        }
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 py-8 relative overflow-hidden bg-[#050505] font-sans text-white">
            {/* Ambient Background Glow */}
            <div className="absolute inset-0 z-0 pointer-events-none">
                <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-[#E97132]/10 rounded-full blur-[120px] animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#FE4B13]/10 rounded-full blur-[100px] animate-pulse delay-1000" />
            </div>

            <div className="w-full max-w-3xl relative z-10 animate-fade-in-up transition-all duration-500 my-4 p-2 sm:p-4">

                {/* Top Control Row: Back Button & Language Selector */}
                <div className="flex items-center justify-between gap-4 mb-6">
                    <button
                        type="button"
                        onClick={() => onNavigate('login')}
                        className="text-slate-400 hover:text-white transition-colors p-2.5 rounded-xl bg-slate-900/80 border border-white/10 shadow-sm flex items-center gap-1.5 text-xs font-bold"
                        title="Return to Login"
                    >
                        <ArrowLeft size={16} /> <span>Log Masuk / Login</span>
                    </button>

                    {/* Language Switcher */}
                    <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-2xl border border-slate-800 shadow-inner">
                        <Globe size={14} className="text-orange-400 ml-2 mr-1 shrink-0" />
                        {[
                            { id: 'bm', label: '🇲🇾 BM' },
                            { id: 'en', label: '🇬🇧 EN' },
                            { id: 'zh', label: t('🇨🇳 中文') }
                        ].map(l => (
                            <button
                                key={l.id}
                                type="button"
                                onClick={() => setLang(l.id as Lang)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                    lang === l.id 
                                        ? 'bg-gradient-to-r from-[#E97132] to-[#FE4B13] text-white shadow-md' 
                                        : 'text-slate-400 hover:text-white hover:bg-slate-900'
                                }`}
                            >
                                {l.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* HEADER */}
                <div className="text-center mb-8 pt-2">
                    <div className="flex justify-center mb-3">
                        <img 
                            src="/packsecure-logo.png" 
                            alt="PackSecure OS" 
                            className="h-20 sm:h-28 max-w-full object-contain filter drop-shadow-[0_8px_20px_rgba(233,113,50,0.3)]" 
                        />
                    </div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-[10px] font-bold uppercase tracking-widest mb-2">
                        {localT.badge}
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight uppercase">
                        {localT.title}
                    </h1>
                    <p className="text-slate-400 text-xs sm:text-sm mt-1">
                        {localT.subtitle}
                    </p>
                </div>

                {status === 'success' ? (
                    <div className="text-center space-y-6 animate-fade-in-up py-4">
                        <div className="p-8 bg-green-500/10 border border-green-500/30 rounded-3xl flex flex-col items-center shadow-xl">
                            {avatarFile ? (
                                <img src={avatarFile} alt={name} className="w-20 h-20 rounded-full object-cover border-2 border-green-400 mb-3 shadow-lg" />
                            ) : (
                                <CheckCircle2 size={56} className="text-green-400 mb-4 animate-bounce" />
                            )}
                            <span className="bg-green-500/20 border border-green-500/30 text-green-300 font-mono text-xs px-3 py-1 rounded-full font-bold mb-2">
                                NO. RUJUKAN: {appRefNo}
                            </span>
                            <h3 className="text-xl font-bold text-green-400 mb-2">{localT.successTitle}</h3>
                            <p className="text-slate-300 text-xs sm:text-sm leading-relaxed max-w-lg">
                                {localT.successMsg}
                            </p>
                            <div className="mt-4 p-4 bg-black/40 border border-white/10 rounded-2xl w-full max-w-md text-left text-xs space-y-1.5 font-mono text-slate-300">
                                <div>📍 Kilang / Factory: <strong className="text-orange-400">{baseLocation}</strong></div>
                                <div>💼 Jawatan / Position: <strong className="text-white">{appliedRole}</strong></div>
                                <div>🖼️ Foto Profil: <strong className={avatarFile ? "text-green-400" : "text-slate-500"}>{avatarFile ? 'Dimuat Naik (Uploaded)' : 'Tidak dilampirkan'}</strong></div>
                                <div>🔑 PIN App: <strong className="text-green-400">{isForeignWorker ? '1234 (Default)' : '****'}</strong></div>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => onNavigate('login')}
                            className="w-full bg-gradient-to-r from-[#E97132] to-[#FE4B13] hover:from-[#FE4B13] hover:to-[#E97132] text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-[#E97132]/20 uppercase tracking-wider text-xs"
                        >
                            {localT.returnLogin}
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleRegister} className="space-y-6">

                        {/* ⚡ FOREIGN WORKER BYPASS ALERT BANNER */}
                        {isForeignWorker && (
                            <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center gap-3 animate-fade-in text-amber-300 text-xs font-bold shadow-lg">
                                <Zap size={20} className="text-amber-400 shrink-0 animate-bounce" />
                                <span>
                                    {lang === 'zh'
                                        ? t('⚡ Speedy submission mode for foreign employees is enabled: all required fields (*) are automatically ignored and direct SUBMIT is allowed! You can fill in the remaining information later on the personal Profile page.')
                                        : (lang === 'en'
                                            ? '⚡ Foreign Worker Express Mode Active: All mandatory (*) requirements bypassed. You can SUBMIT now and complete your profile details later.'
                                            : '⚡ Mod Express Pekerja Asing Aktif: Semua syarat (*) dikecualikan. Anda boleh HANTAR permohonan sekarang dan melengkapkan profil kemudian.')}
                                </span>
                            </div>
                        )}

                        {/* STEP NAVIGATION TABS */}
                        <div className="grid grid-cols-4 gap-1 sm:gap-2 p-1.5 bg-slate-950 rounded-2xl border border-slate-800 text-[10px] sm:text-xs font-bold">
                            <button
                                type="button"
                                onClick={() => setCurrentStep(1)}
                                className={`py-2.5 rounded-xl transition-all flex items-center justify-center gap-1 ${
                                    currentStep === 1 
                                        ? 'bg-orange-600 text-white shadow-md font-black' 
                                        : 'text-slate-500 hover:text-slate-300'
                                }`}
                            >
                                <User size={14} /> <span className="hidden sm:inline">{localT.step1}</span> <span className="sm:hidden">1</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setCurrentStep(2)}
                                className={`py-2.5 rounded-xl transition-all flex items-center justify-center gap-1 ${
                                    currentStep === 2 
                                        ? 'bg-orange-600 text-white shadow-md font-black' 
                                        : 'text-slate-500 hover:text-slate-300'
                                }`}
                            >
                                <Building size={14} /> <span className="hidden sm:inline">{localT.step2}</span> <span className="sm:hidden">2</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setCurrentStep(3)}
                                className={`py-2.5 rounded-xl transition-all flex items-center justify-center gap-1 ${
                                    currentStep === 3 
                                        ? 'bg-orange-600 text-white shadow-md font-black' 
                                        : 'text-slate-500 hover:text-slate-300'
                                }`}
                            >
                                <CreditCard size={14} /> <span className="hidden sm:inline">{localT.step3}</span> <span className="sm:hidden">3</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setCurrentStep(4)}
                                className={`py-2.5 rounded-xl transition-all flex items-center justify-center gap-1 ${
                                    currentStep === 4 
                                        ? 'bg-orange-600 text-white shadow-md font-black' 
                                        : 'text-slate-500 hover:text-slate-300'
                                }`}
                            >
                                <ShieldCheck size={14} /> <span className="hidden sm:inline">{localT.step4}</span> <span className="sm:hidden">4</span>
                            </button>
                        </div>

                        {/* ── STEP 1: PERSONAL PARTICULAR & AVATAR ── */}
                        {currentStep === 1 && (
                            <div className="space-y-4 animate-fade-in">
                                <div className="text-xs font-bold text-orange-400 uppercase tracking-widest border-b border-white/10 pb-2 flex items-center gap-2">
                                    <User size={16} /> {localT.sec1Title}
                                </div>

                                {/* ── PROFILE PHOTO AVATAR UPLOAD BOX ── */}
                                <div className="p-4 bg-[#08080a] border border-slate-800 rounded-2xl flex flex-col sm:flex-row items-center gap-4">
                                    <div className="relative group shrink-0">
                                        {avatarFile ? (
                                            <div className="relative">
                                                <img 
                                                    src={avatarFile} 
                                                    alt="Avatar Preview" 
                                                    className="w-24 h-24 rounded-2xl object-cover border-2 border-orange-500 shadow-xl"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setAvatarFile(null)}
                                                    className="absolute -top-2 -right-2 p-1.5 bg-red-600 text-white rounded-full shadow-lg hover:bg-red-500 transition-colors"
                                                    title="Remove Photo"
                                                >
                                                    <Trash2 size={12} />
                                                </button>
                                            </div>
                                        ) : (
                                            <label className="w-24 h-24 rounded-2xl border-2 border-dashed border-slate-700 hover:border-orange-500 bg-slate-900/50 hover:bg-slate-900 flex flex-col items-center justify-center cursor-pointer transition-all">
                                                <Camera size={24} className="text-orange-400 mb-1" />
                                                <span className="text-[10px] text-slate-400 font-bold uppercase">Foto</span>
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    className="hidden"
                                                    onChange={(e) => handleFileRead(e, setAvatarFile, setAvatarName)}
                                                />
                                            </label>
                                        )}
                                    </div>

                                    <div className="text-center sm:text-left space-y-1 flex-1">
                                        <label className="block text-xs font-bold text-white uppercase tracking-wide">
                                            {localT.uploadAvatar}
                                        </label>
                                        <p className="text-[11px] text-slate-400 leading-relaxed">
                                            {localT.avatarTip}
                                        </p>
                                        {avatarFile ? (
                                            <div className="inline-flex items-center gap-1.5 text-xs text-green-400 font-mono font-bold mt-1 bg-green-500/10 px-2.5 py-1 rounded-lg border border-green-500/20">
                                                <CheckCircle2 size={14} /> <span>{avatarName || 'Gambar Profil Dimuat Naik'}</span>
                                            </div>
                                        ) : (
                                            <label className="inline-block mt-2 px-3 py-1.5 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 text-orange-400 rounded-xl text-xs font-bold cursor-pointer transition-all">
                                                📷 {localT.chooseFile}
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    className="hidden"
                                                    onChange={(e) => handleFileRead(e, setAvatarFile, setAvatarName)}
                                                />
                                            </label>
                                        )}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {/* Full Name */}
                                    <div className="sm:col-span-2">
                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                                            {localT.fullName} {!isForeignWorker && '*'}
                                        </label>
                                        <input
                                            type="text"
                                            required={!isForeignWorker}
                                            className="w-full bg-[#08080a] border border-slate-800 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-[#E97132] transition-all text-sm font-bold uppercase"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            placeholder="e.g. AHMAD BIN ABDULLAH / JOHN DOE"
                                        />
                                    </div>

                                    {/* IC Type & Number */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                                            {localT.icDocType}
                                        </label>
                                        <div className="grid grid-cols-2 gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setIcType('MyKad')}
                                                className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                                                    icType === 'MyKad' 
                                                        ? 'bg-orange-500/20 text-orange-400 border-orange-500/40' 
                                                        : 'bg-black/40 text-slate-500 border-slate-800'
                                                }`}
                                            >
                                                {localT.mykad}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setIcType('Passport')}
                                                className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                                                    icType === 'Passport' 
                                                        ? 'bg-orange-500/20 text-orange-400 border-orange-500/40' 
                                                        : 'bg-black/40 text-slate-500 border-slate-800'
                                                }`}
                                            >
                                                {localT.passport}
                                            </button>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                                            {localT.icNumber} {!isForeignWorker && '*'}
                                        </label>
                                        <input
                                            type="text"
                                            required={!isForeignWorker}
                                            className="w-full bg-[#08080a] border border-slate-800 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-[#E97132] transition-all text-sm font-mono"
                                            value={icNumber}
                                            onChange={(e) => setIcNumber(e.target.value)}
                                            placeholder={icType === 'MyKad' ? '950812-08-5432' : 'A12345678'}
                                        />
                                    </div>

                                    {/* Gender */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                                            {localT.gender}
                                        </label>
                                        <select
                                            value={gender}
                                            onChange={(e: any) => setGender(e.target.value)}
                                            className="w-full bg-[#08080a] border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#E97132] transition-all text-sm"
                                        >
                                            <option value="Lelaki / Male">{t('Lelaki / Male / male')}</option>
                                            <option value="Perempuan / Female">{t('Perempuan / Female / Female')}</option>
                                        </select>
                                    </div>

                                    {/* Date of Birth */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                                            {localT.dob}
                                        </label>
                                        <input
                                            type="date"
                                            className="w-full bg-[#08080a] border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#E97132] transition-all text-sm"
                                            value={dob}
                                            onChange={(e) => setDob(e.target.value)}
                                        />
                                    </div>

                                    {/* Race & Religion */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                                            {localT.race}
                                        </label>
                                        <select
                                            value={race}
                                            onChange={(e) => setRace(e.target.value)}
                                            className="w-full bg-[#08080a] border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#E97132] transition-all text-sm"
                                        >
                                            <option value="Melayu">Melayu / Malay</option>
                                            <option value="Cina">Cina / Chinese</option>
                                            <option value="India">India / Indian</option>
                                            <option value="Pekerja Asing (Foreigner)">Pekerja Asing / Foreign Worker</option>
                                            <option value="Lain-lain">Lain-lain / Others</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                                            {localT.marital}
                                        </label>
                                        <select
                                            value={maritalStatus}
                                            onChange={(e) => setMaritalStatus(e.target.value)}
                                            className="w-full bg-[#08080a] border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#E97132] transition-all text-sm"
                                        >
                                            <option value="Bujang / Single">{t('Bujang / Single / Unmarried')}</option>
                                            <option value="Kahwin / Married">{t('Kahwin / Married / married')}</option>
                                            <option value="Duda/Janda / Divorced">{t('Duda/Janda / Divorced / Divorced')}</option>
                                        </select>
                                    </div>

                                    {/* Phone & Email */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                                            {localT.phone} {!isForeignWorker && '*'}
                                        </label>
                                        <input
                                            type="tel"
                                            required={!isForeignWorker}
                                            className="w-full bg-[#08080a] border border-slate-800 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-[#E97132] transition-all text-sm font-mono"
                                            value={phone}
                                            onChange={(e) => setPhone(e.target.value)}
                                            placeholder="012-3456789"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                                            {localT.email}
                                        </label>
                                        <input
                                            type="email"
                                            className="w-full bg-[#08080a] border border-slate-800 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-[#E97132] transition-all text-sm font-mono"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder="name@gmail.com"
                                        />
                                    </div>

                                    {/* Full Residential Address */}
                                    <div className="sm:col-span-2">
                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                                            {localT.address}
                                        </label>
                                        <textarea
                                            rows={2}
                                            className="w-full bg-[#08080a] border border-slate-800 rounded-xl p-3 text-white placeholder-slate-600 focus:outline-none focus:border-[#E97132] transition-all text-sm"
                                            value={address}
                                            onChange={(e) => setAddress(e.target.value)}
                                            placeholder="No. Rumah, Jalan, Taman / Kampung..."
                                        />
                                    </div>

                                    {/* ── FILE UPLOAD BOXES (SUPPORTING DOCUMENTS) ── */}
                                    <div className="sm:col-span-2 space-y-3 pt-2">
                                        <label className="block text-xs font-bold text-orange-400 uppercase tracking-wider">
                                            📁 Lampiran Dokumen (Document Uploads)
                                        </label>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            {/* 1. IC / Passport Upload */}
                                            <div className="p-3 bg-[#08080a] border border-slate-800 rounded-2xl flex flex-col justify-between">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                                                        <FileText size={14} className="text-orange-400" /> {localT.uploadIc}
                                                    </span>
                                                </div>

                                                {icDocFile ? (
                                                    <div className="flex items-center justify-between bg-orange-500/10 border border-orange-500/30 p-2 rounded-xl">
                                                        <div className="flex items-center gap-2 truncate text-xs font-mono text-orange-300">
                                                            <CheckCircle2 size={16} className="text-green-400 shrink-0" />
                                                            <span className="truncate">{icDocName}</span>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => { setIcDocFile(null); setIcDocName(''); }}
                                                            className="p-1 text-slate-400 hover:text-red-400"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <label className="cursor-pointer border border-dashed border-slate-700 hover:border-orange-500 bg-slate-900/50 hover:bg-slate-900 p-3 rounded-xl flex items-center justify-center gap-2 text-xs text-slate-400 transition-all">
                                                        <Upload size={14} className="text-orange-400" />
                                                        <span>{localT.chooseFile}</span>
                                                        <input
                                                            type="file"
                                                            accept="image/*,application/pdf"
                                                            className="hidden"
                                                            onChange={(e) => handleFileRead(e, setIcDocFile, setIcDocName)}
                                                        />
                                                    </label>
                                                )}
                                            </div>

                                            {/* 2. License Upload (Optional) */}
                                            <div className="p-3 bg-[#08080a] border border-slate-800 rounded-2xl flex flex-col justify-between">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                                                        <FileText size={14} className="text-orange-400" /> {localT.uploadLicense}
                                                    </span>
                                                </div>

                                                {licenseDocFile ? (
                                                    <div className="flex items-center justify-between bg-orange-500/10 border border-orange-500/30 p-2 rounded-xl">
                                                        <div className="flex items-center gap-2 truncate text-xs font-mono text-orange-300">
                                                            <CheckCircle2 size={16} className="text-green-400 shrink-0" />
                                                            <span className="truncate">{licenseDocName}</span>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => { setLicenseDocFile(null); setLicenseDocName(''); }}
                                                            className="p-1 text-slate-400 hover:text-red-400"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <label className="cursor-pointer border border-dashed border-slate-700 hover:border-orange-500 bg-slate-900/50 hover:bg-slate-900 p-3 rounded-xl flex items-center justify-center gap-2 text-xs text-slate-400 transition-all">
                                                        <Upload size={14} className="text-orange-400" />
                                                        <span>{localT.chooseFile}</span>
                                                        <input
                                                            type="file"
                                                            accept="image/*,application/pdf"
                                                            className="hidden"
                                                            onChange={(e) => handleFileRead(e, setLicenseDocFile, setLicenseDocName)}
                                                        />
                                                    </label>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex justify-between items-center pt-2">
                                    {isForeignWorker && (
                                        <button
                                            type="submit"
                                            onClick={handleRegister}
                                            className="bg-amber-600 hover:bg-amber-500 text-white font-bold px-5 py-2.5 rounded-xl text-xs uppercase tracking-wider transition-all shadow-md flex items-center gap-1.5"
                                        >
                                            <Zap size={14} /> {lang === 'zh' ? t('⚡ Foreign employees submit directly (SUBMIT NOW)') : '⚡ HANTAR SEKARANG (SUBMIT NOW)'}
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => setCurrentStep(2)}
                                        className="bg-orange-600 hover:bg-orange-500 text-white font-bold px-6 py-2.5 rounded-xl text-xs uppercase tracking-wider transition-all ml-auto"
                                    >
                                        {localT.nextTo2}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* ── STEP 2: POSITION & FACTORY ── */}
                        {currentStep === 2 && (
                            <div className="space-y-4 animate-fade-in">
                                <div className="text-xs font-bold text-orange-400 uppercase tracking-widest border-b border-white/10 pb-2 flex items-center gap-2">
                                    <Building size={16} /> {localT.sec2Title}
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {/* Base Location Selection */}
                                    <div className="sm:col-span-2">
                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                                            {localT.prefLocation}
                                        </label>
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                            {[
                                                { id: 'Taiping', label: 'Taiping (Perak)' },
                                                { id: 'Nilai', label: 'Nilai (N. Sembilan)' },
                                                { id: 'Kelantan', label: 'Kelantan' },
                                                { id: 'Johor', label: 'Johor' }
                                            ].map(loc => (
                                                <button
                                                    key={loc.id}
                                                    type="button"
                                                    onClick={() => setBaseLocation(loc.id as any)}
                                                    className={`py-3 px-3 rounded-xl text-xs font-bold transition-all border flex flex-col items-center justify-center gap-1 ${
                                                        baseLocation === loc.id
                                                            ? 'bg-orange-500 text-white border-orange-400 shadow-lg shadow-orange-950/50'
                                                            : 'bg-[#08080a] text-slate-400 border-slate-800 hover:border-slate-700'
                                                    }`}
                                                >
                                                    <MapPin size={16} />
                                                    <span>{loc.label}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Applied Role */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                                            {localT.roleApplied}
                                        </label>
                                        <select
                                            value={appliedRole}
                                            onChange={(e) => setAppliedRole(e.target.value)}
                                            className="w-full bg-[#08080a] border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#E97132] transition-all text-sm font-bold"
                                        >
                                            <option value="Operator">Operator Kilang (Factory Operator)</option>
                                            <option value="Driver">Pemandu Lori (Lorry Driver)</option>
                                            <option value="Executive">Eksekutif / Kerani (Executive)</option>
                                            <option value="Technician">Juruteknik (Technician)</option>
                                            <option value="Supervisor">Penyelia (Supervisor)</option>
                                            <option value="Warehouse">Pekerja Gudang / Storekeeper</option>
                                            <option value="General Worker">Pekerja Am (General Worker)</option>
                                        </select>
                                    </div>

                                    {/* Education Level */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                                            {localT.education}
                                        </label>
                                        <select
                                            value={education}
                                            onChange={(e) => setEducation(e.target.value)}
                                            className="w-full bg-[#08080a] border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#E97132] transition-all text-sm"
                                        >
                                            <option value="PMR/PT3">PMR / PT3</option>
                                            <option value="SPM">SPM</option>
                                            <option value="STPM/Diploma">STPM / Diploma / SKM</option>
                                            <option value="Degree">Ijazah Sarjana Muda (Degree)</option>
                                            <option value="Lain-lain">Lain-lain / Sek. Rendah</option>
                                        </select>
                                    </div>

                                    {/* Driving License Class */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                                            {localT.license}
                                        </label>
                                        <select
                                            value={licenseClass}
                                            onChange={(e) => setLicenseClass(e.target.value)}
                                            className="w-full bg-[#08080a] border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#E97132] transition-all text-sm"
                                        >
                                            <option value="Tiada / None">Tiada / None</option>
                                            <option value="B2 (Motosikal)">B2 (Motosikal)</option>
                                            <option value="D (Kereta)">D (Kereta / Car)</option>
                                            <option value="GDL (Lori Kecil / Van)">GDL (Lori Kecil / Van)</option>
                                            <option value="E / GDL Bersendi (Lori Berat)">E / GDL Bersendi (Lori Berat / Trailer)</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                                            {localT.licenseExp}
                                        </label>
                                        <input
                                            type="date"
                                            className="w-full bg-[#08080a] border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#E97132] transition-all text-sm"
                                            value={licenseExpiry}
                                            onChange={(e) => setLicenseExpiry(e.target.value)}
                                        />
                                    </div>

                                    {/* 3. Resume / Cert Upload (Optional) */}
                                    <div className="sm:col-span-2">
                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                                            {localT.uploadResume}
                                        </label>
                                        <div className="p-3 bg-[#08080a] border border-slate-800 rounded-2xl">
                                            {resumeDocFile ? (
                                                <div className="flex items-center justify-between bg-orange-500/10 border border-orange-500/30 p-2 rounded-xl">
                                                    <div className="flex items-center gap-2 truncate text-xs font-mono text-orange-300">
                                                        <CheckCircle2 size={16} className="text-green-400 shrink-0" />
                                                        <span className="truncate">{resumeDocName}</span>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => { setResumeDocFile(null); setResumeDocName(''); }}
                                                        className="p-1 text-slate-400 hover:text-red-400"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <label className="cursor-pointer border border-dashed border-slate-700 hover:border-orange-500 bg-slate-900/50 hover:bg-slate-900 p-3 rounded-xl flex items-center justify-center gap-2 text-xs text-slate-400 transition-all">
                                                    <Upload size={14} className="text-orange-400" />
                                                    <span>{localT.chooseFile} (PDF / Image)</span>
                                                    <input
                                                        type="file"
                                                        accept="image/*,application/pdf"
                                                        className="hidden"
                                                        onChange={(e) => handleFileRead(e, setResumeDocFile, setResumeDocName)}
                                                    />
                                                </label>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex justify-between items-center pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setCurrentStep(1)}
                                        className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold px-5 py-2.5 rounded-xl text-xs uppercase transition-all"
                                    >
                                        {localT.back}
                                    </button>

                                    <div className="flex items-center gap-2">
                                        {isForeignWorker && (
                                            <button
                                                type="submit"
                                                onClick={handleRegister}
                                                className="bg-amber-600 hover:bg-amber-500 text-white font-bold px-5 py-2.5 rounded-xl text-xs uppercase tracking-wider transition-all shadow-md flex items-center gap-1.5"
                                            >
                                                <Zap size={14} /> {lang === 'zh' ? t('⚡ Foreign employees submit directly') : '⚡ HANTAR SEKARANG'}
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => setCurrentStep(3)}
                                            className="bg-orange-600 hover:bg-orange-500 text-white font-bold px-6 py-2.5 rounded-xl text-xs uppercase tracking-wider transition-all"
                                        >
                                            {localT.nextTo3}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ── STEP 3: STATUTORY & FINANCIAL ── */}
                        {currentStep === 3 && (
                            <div className="space-y-4 animate-fade-in">
                                <div className="text-xs font-bold text-orange-400 uppercase tracking-widest border-b border-white/10 pb-2 flex items-center gap-2">
                                    <CreditCard size={16} /> {localT.sec3Title}
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {/* Bank Name */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                                            {localT.bankName}
                                        </label>
                                        <select
                                            value={bankName}
                                            onChange={(e) => setBankName(e.target.value)}
                                            className="w-full bg-[#08080a] border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#E97132] transition-all text-sm font-bold"
                                        >
                                            <option value="Maybank">Malayan Banking Berhad (Maybank)</option>
                                            <option value="CIMB">CIMB Bank Berhad</option>
                                            <option value="Public Bank">Public Bank Berhad</option>
                                            <option value="RHB Bank">RHB Bank Berhad</option>
                                            <option value="Hong Leong Bank">Hong Leong Bank</option>
                                            <option value="AmBank">AmBank Berhad</option>
                                            <option value="Bank Muamalat">Bank Muamalat Malaysia</option>
                                            <option value="Bank Simpanan Nasional (BSN)">Bank Simpanan Nasional (BSN)</option>
                                            <option value="Alliance Bank">Alliance Bank</option>
                                            <option value="Lain-lain Bank">Lain-lain / Cash</option>
                                        </select>
                                    </div>

                                    {/* Bank Account Number */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                                            {localT.bankAcc} {!isForeignWorker && '*'}
                                        </label>
                                        <input
                                            type="text"
                                            required={!isForeignWorker}
                                            className="w-full bg-[#08080a] border border-slate-800 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-[#E97132] transition-all text-sm font-mono"
                                            value={bankAcc}
                                            onChange={(e) => setBankAcc(e.target.value)}
                                            placeholder="164012345678"
                                        />
                                    </div>

                                    {/* EPF / KWSP No. */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                                            {localT.epf}
                                        </label>
                                        <input
                                            type="text"
                                            className="w-full bg-[#08080a] border border-slate-800 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-[#E97132] transition-all text-sm font-mono"
                                            value={epfNo}
                                            onChange={(e) => setEpfNo(e.target.value)}
                                            placeholder="23456789"
                                        />
                                    </div>

                                    {/* SOCSO / PERKESO No. */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                                            {localT.socso}
                                        </label>
                                        <input
                                            type="text"
                                            className="w-full bg-[#08080a] border border-slate-800 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-[#E97132] transition-all text-sm font-mono"
                                            value={socsoNo}
                                            onChange={(e) => setSocsoNo(e.target.value)}
                                            placeholder="No. IC / Passport"
                                        />
                                    </div>
                                </div>

                                <div className="flex justify-between items-center pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setCurrentStep(2)}
                                        className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold px-5 py-2.5 rounded-xl text-xs uppercase transition-all"
                                    >
                                        {localT.back}
                                    </button>

                                    <div className="flex items-center gap-2">
                                        {isForeignWorker && (
                                            <button
                                                type="submit"
                                                onClick={handleRegister}
                                                className="bg-amber-600 hover:bg-amber-500 text-white font-bold px-5 py-2.5 rounded-xl text-xs uppercase tracking-wider transition-all shadow-md flex items-center gap-1.5"
                                            >
                                                <Zap size={14} /> {lang === 'zh' ? t('⚡ Foreign employees submit directly') : '⚡ HANTAR SEKARANG'}
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => setCurrentStep(4)}
                                            className="bg-orange-600 hover:bg-orange-500 text-white font-bold px-6 py-2.5 rounded-xl text-xs uppercase tracking-wider transition-all"
                                        >
                                            {localT.nextTo4}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ── STEP 4: EMERGENCY CONTACT & SECURITY PIN ── */}
                        {currentStep === 4 && (
                            <div className="space-y-4 animate-fade-in">
                                <div className="text-xs font-bold text-orange-400 uppercase tracking-widest border-b border-white/10 pb-2 flex items-center gap-2">
                                    <ShieldCheck size={16} /> {localT.sec4Title}
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {/* Emergency Contact Name */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                                            {localT.emergName} {!isForeignWorker && '*'}
                                        </label>
                                        <input
                                            type="text"
                                            required={!isForeignWorker}
                                            className="w-full bg-[#08080a] border border-slate-800 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-[#E97132] transition-all text-sm font-bold"
                                            value={emergencyName}
                                            onChange={(e) => setEmergencyName(e.target.value)}
                                            placeholder="Nama waris"
                                        />
                                    </div>

                                    {/* Relationship */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                                            {localT.emergRelation}
                                        </label>
                                        <select
                                            value={emergencyRelation}
                                            onChange={(e) => setEmergencyRelation(e.target.value)}
                                            className="w-full bg-[#08080a] border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#E97132] transition-all text-sm"
                                        >
                                            <option value="Ibu/Bapa (Parent)">{t('Ibu / Bapa (Parent / parent)')}</option>
                                            <option value="Suami/Isteri (Spouse)">{t('Suami / Isteri (Spouse / spouse)')}</option>
                                            <option value="Adik-Beradik (Sibling)">{t('Adik-Beradik (Sibling / brother and sister)')}</option>
                                            <option value="Anak (Child)">{t('Anak (Child/child)')}</option>
                                            <option value="Rakan (Friend)">Rakan / Lain-lain (Friend)</option>
                                        </select>
                                    </div>

                                    {/* Emergency Phone */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                                            {localT.emergPhone} {!isForeignWorker && '*'}
                                        </label>
                                        <input
                                            type="tel"
                                            required={!isForeignWorker}
                                            className="w-full bg-[#08080a] border border-slate-800 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-[#E97132] transition-all text-sm font-mono"
                                            value={emergencyPhone}
                                            onChange={(e) => setEmergencyPhone(e.target.value)}
                                            placeholder="019-8765432"
                                        />
                                    </div>

                                    {/* 4-Digit Security PIN */}
                                    <div>
                                        <label className="block text-xs font-bold text-[#E97132] uppercase tracking-wider mb-1">
                                            {localT.pinCode} {!isForeignWorker && '*'}
                                        </label>
                                        <div className="relative">
                                            <Lock size={16} className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-500" />
                                            <input
                                                type="password"
                                                inputMode="numeric"
                                                pattern="[0-9]{4}"
                                                maxLength={4}
                                                required={!isForeignWorker}
                                                className="w-full bg-[#08080a] border border-orange-500/50 rounded-xl pl-12 pr-4 py-3 text-white focus:outline-none focus:border-[#E97132] transition-all font-mono text-lg tracking-widest"
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value.replace(/\D/g, '').slice(0, 4))}
                                                placeholder="••••"
                                            />
                                        </div>
                                        <span className="block text-[10px] text-slate-500 mt-1">
                                            {localT.pinTip}
                                        </span>
                                    </div>

                                    {/* Health Declaration */}
                                    <div className="sm:col-span-2">
                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                                            {localT.health}
                                        </label>
                                        <input
                                            type="text"
                                            className="w-full bg-[#08080a] border border-slate-800 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-[#E97132] transition-all text-sm"
                                            value={healthConditions}
                                            onChange={(e) => setHealthConditions(e.target.value)}
                                            placeholder="Sihat / Tiada Penyakit Kronik (Healthy / No Chronic Illness)"
                                        />
                                    </div>
                                </div>

                                {/* Statutory Declaration Checkbox */}
                                <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-2xl">
                                    <label className="flex items-start gap-3 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            required={!isForeignWorker}
                                            checked={declaration || isForeignWorker}
                                            onChange={(e) => setDeclaration(e.target.checked)}
                                            className="mt-1 w-4 h-4 text-orange-500 rounded bg-slate-900 border-slate-700 focus:ring-orange-500"
                                        />
                                        <span className="text-xs text-slate-300 leading-relaxed">
                                            {localT.declarationText}
                                        </span>
                                    </label>
                                </div>

                                {errorMsg && (
                                    <div className="text-red-400 text-xs text-center bg-red-500/10 py-3 rounded-xl border border-red-500/20 animate-shake">
                                        ⚠️ {errorMsg}
                                    </div>
                                )}

                                <div className="flex justify-between pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setCurrentStep(3)}
                                        className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold px-5 py-3 rounded-xl text-xs uppercase transition-all"
                                    >
                                        {localT.back}
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={status === 'loading'}
                                        className="flex-1 ml-3 bg-gradient-to-r from-[#E97132] to-[#FE4B13] hover:from-[#FE4B13] hover:to-[#E97132] text-white font-bold py-3.5 rounded-xl shadow-lg shadow-[#E97132]/20 transition-all text-xs uppercase tracking-wider disabled:opacity-50"
                                    >
                                        {status === 'loading' ? localT.submitting : localT.submitBtn}
                                    </button>
                                </div>
                            </div>
                        )}
                    </form>
                )}
            </div>

            {/* Footer */}
            <div className="mt-4 text-center z-10 text-slate-500 text-[10px] tracking-widest uppercase">
                System v6.7 • Packsecure OS Official Recruitment Portal (JTK Malaysia)
            </div>
        </div>
    );
};

export default Register;
