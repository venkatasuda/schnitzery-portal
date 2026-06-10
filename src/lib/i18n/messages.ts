// Central translation dictionary. Add keys as screens get translated.
// Any key missing from a locale falls back to English, and a missing English
// key falls back to showing the key itself — so the app never breaks mid-rollout.
//
// Usage: t("nav.home")

export const messages = {
  en: {
    nav: {
      home: "Home", myDay: "My Day", shifts: "Shifts", schedule: "Schedule",
      attendance: "Attendance", inventory: "Inventory", profile: "Profile", branches: "Branches",
    },
    common: {
      save: "Save", saving: "Saving…", cancel: "Cancel", submit: "Submit", submitting: "Submitting…",
      edit: "Edit", delete: "Delete", add: "Add", back: "Back", close: "Close",
      loading: "Loading…", managersOnly: "Managers only.", yes: "Yes", no: "No",
    },
    roles: {
      brand_owner: "Brand Owner", franchise_owner: "Franchise Owner", manager: "Manager", staff: "Staff",
    },
    greeting: { morning: "Good morning", afternoon: "Good afternoon", evening: "Good evening" },

    profile: {
      title: "My Profile", subtitle: "Your details and skills",
      employeeCode: "Employee code", email: "Email", phone: "Phone",
      contract: "Contract", contractHours: "Contract hours", status: "Status",
      skills: "Skills", noSkills: "No skills listed.", editProfile: "Edit Profile",
      fullName: "Full name", skillsLabel: "Skills (comma-separated)",
      skillsPlaceholder: "Grill, Cashier, Opening",
      managerNote: "Team, contract & role are set by your manager.",
      couldNotLoad: "Could not load profile.",
      settingsAdmin: "Settings & Admin",
      branchSettings: "Branch Settings", branchSettingsSub: "QR clock-in, GPS check & options",
      payrollExport: "Payroll Export", payrollExportSub: "Monthly hours per staff — CSV",
      auditLog: "Audit Log", auditLogSub: "Every manager action, time-stamped",
    },

    documents: {
      title: "My Documents", upload: "+ Upload", none: "No documents yet.",
      noneHint: "Tap + Upload to add visa, ID, contract, etc.", view: "View",
      uploadTitle: "Upload Document",
      typeHint: "Select the type — max 5 MB · PDF / JPG / PNG / HEIC",
      datesHint: "Add dates (optional), then choose the file.",
      issued: "Issued", expires: "Expires", chooseUpload: "Choose File & Upload",
      uploading: "Uploading…",
      type_id_card: "ID Card / Passport", type_visa: "Visa / Residence Permit",
      type_work_permit: "Work Permit", type_contract: "Contract",
      type_certificate: "Certificate", type_other: "Other",
      tooBig: "File must be under 5 MB.", uploaded: "Document uploaded.",
      uploadFailed: "Upload failed: ", couldNotOpen: "Could not open document.",
      deleted: "Document deleted.", deleteFailed: "Delete failed.",
      confirmDelete: "Delete this document?",
    },

    settings: {
      preferences: "Preferences", lightMode: "Light Mode",
      lightModeSub: "Switch between light & dark theme", account: "Account",
      changePassword: "Change Password",
      newPwPlaceholder: "New password (min 8 characters)",
      confirmPwPlaceholder: "Confirm new password", updatePassword: "Update Password",
      pwTooShort: "Password must be at least 8 characters.",
      pwMismatch: "The two passwords don't match.",
      pwUpdated: "Password updated.", pwError: "Could not change password.",
    },

    auth: { logOut: "Log Out", signingOut: "Signing out…" },
  },

  de: {
    nav: {
      home: "Start", myDay: "Mein Tag", shifts: "Schichten", schedule: "Dienstplan",
      attendance: "Zeiterfassung", inventory: "Inventar", profile: "Profil", branches: "Filialen",
    },
    common: {
      save: "Speichern", saving: "Speichern…", cancel: "Abbrechen", submit: "Absenden", submitting: "Wird gesendet…",
      edit: "Bearbeiten", delete: "Löschen", add: "Hinzufügen", back: "Zurück", close: "Schließen",
      loading: "Lädt…", managersOnly: "Nur für Manager.", yes: "Ja", no: "Nein",
    },
    roles: {
      brand_owner: "Markeninhaber", franchise_owner: "Franchise-Inhaber", manager: "Manager", staff: "Mitarbeiter",
    },
    greeting: { morning: "Guten Morgen", afternoon: "Guten Tag", evening: "Guten Abend" },

    profile: {
      title: "Mein Profil", subtitle: "Deine Daten und Fähigkeiten",
      employeeCode: "Mitarbeiter-Code", email: "E-Mail", phone: "Telefon",
      contract: "Vertrag", contractHours: "Vertragsstunden", status: "Status",
      skills: "Fähigkeiten", noSkills: "Keine Fähigkeiten angegeben.", editProfile: "Profil bearbeiten",
      fullName: "Vollständiger Name", skillsLabel: "Fähigkeiten (kommagetrennt)",
      skillsPlaceholder: "Grill, Kasse, Öffnen",
      managerNote: "Team, Vertrag und Rolle werden von deinem Manager festgelegt.",
      couldNotLoad: "Profil konnte nicht geladen werden.",
      settingsAdmin: "Einstellungen & Verwaltung",
      branchSettings: "Filialeinstellungen", branchSettingsSub: "QR-Einstempeln, GPS-Prüfung & Optionen",
      payrollExport: "Lohnabrechnung-Export", payrollExportSub: "Monatsstunden pro Mitarbeiter — CSV",
      auditLog: "Prüfprotokoll", auditLogSub: "Jede Manager-Aktion, mit Zeitstempel",
    },

    documents: {
      title: "Meine Dokumente", upload: "+ Hochladen", none: "Noch keine Dokumente.",
      noneHint: "Tippe auf + Hochladen, um Visum, Ausweis, Vertrag usw. hinzuzufügen.", view: "Ansehen",
      uploadTitle: "Dokument hochladen",
      typeHint: "Typ auswählen — max. 5 MB · PDF / JPG / PNG / HEIC",
      datesHint: "Daten hinzufügen (optional), dann Datei wählen.",
      issued: "Ausgestellt", expires: "Läuft ab", chooseUpload: "Datei wählen & hochladen",
      uploading: "Wird hochgeladen…",
      type_id_card: "Ausweis / Reisepass", type_visa: "Visum / Aufenthaltstitel",
      type_work_permit: "Arbeitserlaubnis", type_contract: "Vertrag",
      type_certificate: "Zertifikat", type_other: "Sonstiges",
      tooBig: "Datei muss kleiner als 5 MB sein.", uploaded: "Dokument hochgeladen.",
      uploadFailed: "Upload fehlgeschlagen: ", couldNotOpen: "Dokument konnte nicht geöffnet werden.",
      deleted: "Dokument gelöscht.", deleteFailed: "Löschen fehlgeschlagen.",
      confirmDelete: "Dieses Dokument löschen?",
    },

    settings: {
      preferences: "Einstellungen", lightMode: "Heller Modus",
      lightModeSub: "Zwischen hellem & dunklem Design wechseln", account: "Konto",
      changePassword: "Passwort ändern",
      newPwPlaceholder: "Neues Passwort (mind. 8 Zeichen)",
      confirmPwPlaceholder: "Neues Passwort bestätigen", updatePassword: "Passwort aktualisieren",
      pwTooShort: "Das Passwort muss mindestens 8 Zeichen lang sein.",
      pwMismatch: "Die beiden Passwörter stimmen nicht überein.",
      pwUpdated: "Passwort aktualisiert.", pwError: "Passwort konnte nicht geändert werden.",
    },

    auth: { logOut: "Abmelden", signingOut: "Abmeldung…" },
  },
} as const;