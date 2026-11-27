import { Link } from 'react-router-dom';

export function PrivacyPage() {
  return (
    <section className="page-section">
      <div className="container" style={{ maxWidth: 820 }}>
        <div className="card">
          <span className="badge badge-amber">Proposed University Project Notice</span>
          <h1 style={{ marginTop: 12 }}>Privacy Notice &amp; Data Protection</h1>
          <p className="muted">
            This application is a proposed Campus Lost and Found Management System created for a
            university project referencing Bugema University. It has not been officially adopted or
            deployed by Bugema University, and demonstration data is entirely fictional.
          </p>

          <h2>1. Information We Collect</h2>
          <ul>
            <li>
              <strong>Account &amp; Profile Details:</strong> Student ID, full name, academic course,
              email address, and phone number. Passwords are stored exclusively as salted cryptographic
              hashes and never stored or logged in plaintext.
            </li>
            <li>
              <strong>Lost &amp; Found Reports:</strong> Item names, categories, general descriptions,
              campus locations, dates, optional photographs, contact preference, and private identifying
              details.
            </li>
            <li>
              <strong>Ownership Claims &amp; Verification Records:</strong> Claim explanations,
              identifying proof submitted by claimants, staff verification notes, reviewer identity,
              and audit log entries of status changes.
            </li>
          </ul>

          <h2>2. Why Information Is Collected</h2>
          <p>
            Information is used solely to match lost property with found items, contact owners through
            their preferred channel, allow authorized staff to verify ownership before releasing stored
            property, and maintain an accountability audit trail.
          </p>

          <h2>3. Public vs. Private Visibility</h2>
          <ul>
            <li>
              <strong>Unauthenticated visitors</strong> can view only general non-sensitive summaries
              of lost and found items (item title, category, general description, location, date, and
              status). Private student profiles, contact details, and hidden identifying marks are never
              exposed publicly.
            </li>
            <li>
              <strong>Students</strong> can view and manage only their own lost reports and their own
              claims. Sensitive identifying details on found items remain hidden from claimants to
              prevent fraudulent claims.
            </li>
            <li>
              <strong>Authorized staff</strong> can access private identifying details and claim
              submissions solely to verify ownership and record release outcomes.
            </li>
          </ul>

          <h2>4. Security Practices</h2>
          <p>
            All API endpoints enforce server-side authentication, role-based access control, input
            validation, rate limiting on authentication and claim submission routes, and binary
            magic-byte inspection for uploaded images. Sensitive claim evidence and passwords are never
            written to application logs or audit trails.
          </p>

          <div style={{ marginTop: 24 }}>
            <Link to="/" className="btn btn-secondary">
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
