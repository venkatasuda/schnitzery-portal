// ============================================================================
// RETIRED — do not add anything to this file. DELETE IT:  git rm src/lib/queries/profile-uploads.ts
//
// This module used to export Server Actions for document upload/listing/signing
// and the avatar URL setter. It was superseded by src/lib/queries/documents.ts,
// but was left in place — and because it was a "use server" module, EVERY export
// remained a live, publicly-callable POST endpoint whether or not any component
// imported it.
//
// Two of them were exploitable:
//   • getDocumentUrl(filePath) signed a URL for ANY path in the private
//     'documents' bucket with no ownership check — passports, visas, contracts.
//   • deleteDocument(id, filePath) scoped the database delete to the caller but
//     NOT the storage delete, letting any user delete any colleague's file.
//
// The replacements in documents.ts check access before signing (getDocumentUrl)
// and archive rather than hard-delete (archiveDocument). setAvatarUrl now lives
// in documents.ts too, with URL validation.
//
// Left as an empty module only because the file could not be deleted in the
// session that made this change. It has no exports and no "use server"
// directive, so it registers no endpoints.
// ============================================================================

export {};
