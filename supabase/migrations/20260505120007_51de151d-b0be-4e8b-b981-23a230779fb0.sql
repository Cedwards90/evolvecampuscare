
-- NDA documents (versioned)
CREATE TABLE public.nda_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version integer NOT NULL UNIQUE,
  title text NOT NULL,
  body_markdown text NOT NULL,
  effective_at timestamptz NOT NULL DEFAULT now(),
  is_current boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Only one current version
CREATE UNIQUE INDEX nda_documents_one_current ON public.nda_documents (is_current) WHERE is_current = true;

ALTER TABLE public.nda_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view NDA documents"
  ON public.nda_documents FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage NDA documents"
  ON public.nda_documents FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Acceptances
CREATE TABLE public.nda_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  nda_document_id uuid NOT NULL REFERENCES public.nda_documents(id) ON DELETE CASCADE,
  version integer NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  ip_address text,
  user_agent text,
  UNIQUE (user_id, nda_document_id)
);

CREATE INDEX nda_acceptances_user_idx ON public.nda_acceptances(user_id);

ALTER TABLE public.nda_acceptances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own acceptances"
  ON public.nda_acceptances FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users insert own acceptance"
  ON public.nda_acceptances FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins view all acceptances"
  ON public.nda_acceptances FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Seed v1 NDA
INSERT INTO public.nda_documents (version, title, body_markdown, is_current, effective_at)
VALUES (
  1,
  'Evolve Foundation Platform Non-Disclosure & Non-Use Agreement',
  $md$# Evolve Foundation Platform Non-Disclosure & Non-Use Agreement

**Effective Date:** Upon acceptance by you ("User", "you", "your")
**Disclosing Party:** Evolve Foundation ("Evolve", "we", "us", "our")

By clicking "I Accept" below, you enter into a binding agreement with Evolve Foundation governing your access to and use of the Evolve Campus Care platform (the "Platform"). If you do not agree, you must not access or use the Platform.

## 1. Confidential Information

"Confidential Information" means any and all non-public information disclosed to you, observed by you, or made accessible to you through the Platform, including without limitation:

- the Platform's user interface, screens, layouts, navigation flows, visual design, and overall "look and feel";
- workflows, business logic, processes, features, functionality, and the manner in which features interact;
- source code, object code, scripts, APIs, data models, database schemas, and architectural designs;
- screenshots, recordings, documentation, training materials, and internal communications;
- student records, case manager notes, organizational data, intake responses, messages, and any other personal data of users;
- pricing, roadmap, marketing strategy, partnerships, and any other business information of Evolve Foundation;
- any information that, given its nature or the circumstances of disclosure, a reasonable person would understand to be confidential.

## 2. Obligations of Confidentiality

You agree to:

a. hold all Confidential Information in strict confidence;
b. not disclose Confidential Information to any third party without Evolve's prior written consent;
c. use Confidential Information solely for the purpose authorized by your role on the Platform (e.g., as a Student, Case Manager, Organizational Admin, or Administrator);
d. protect Confidential Information using at least the same degree of care you use for your own confidential information, and in no event less than reasonable care.

## 3. No Copying, Reverse Engineering, or Recreation

You expressly agree that you will **not**, directly or indirectly:

a. copy, reproduce, screenshot for distribution, scrape, mirror, or download any portion of the Platform other than as necessary for your own authorized use;
b. reverse engineer, decompile, disassemble, or otherwise attempt to derive the source code, structure, or underlying ideas of the Platform;
c. design, develop, build, fund, sponsor, advise, or assist any other person in designing, developing, or building any product or service that is the same as, substantially similar to, or competitive with the Platform;
d. use any Confidential Information to create derivative works, clones, "inspired by" products, or training data for machine learning models;
e. circumvent, disable, or interfere with security or access-control features of the Platform.

## 4. Intellectual Property

All right, title, and interest in and to the Platform — including all software, designs, content, trademarks, and Confidential Information — are and shall remain the sole and exclusive property of Evolve Foundation. No license, ownership interest, or other right is granted to you except the limited, revocable right to use the Platform for its intended purpose during the term of your authorized access.

## 5. Permitted Use

Your use of the Platform is strictly limited to the functions made available to your assigned role and to the legitimate business purpose of providing or receiving student support services through Evolve Foundation. Any other use is unauthorized.

## 6. Term & Survival

This Agreement is effective from the moment you accept it and continues for as long as you have access to the Platform. Your obligations of confidentiality and the prohibitions in Sections 2, 3, and 4 **survive** termination of your account indefinitely with respect to all Confidential Information disclosed to you.

## 7. Remedies

You acknowledge that any breach of this Agreement would cause Evolve Foundation irreparable harm for which monetary damages would be inadequate. Accordingly, Evolve shall be entitled, in addition to any other remedies available at law or in equity, to:

- injunctive relief and specific performance, without the necessity of posting bond;
- recovery of actual, consequential, and punitive damages where permitted by law;
- recovery of reasonable attorneys' fees and costs incurred in enforcing this Agreement.

## 8. Required Disclosure

If you are legally compelled to disclose Confidential Information (e.g., by subpoena), you will, to the extent legally permitted, give Evolve prompt prior written notice and reasonable cooperation so that Evolve may seek a protective order or other appropriate remedy.

## 9. No Warranty

The Platform and any Confidential Information are provided "as is" without warranty of any kind. Nothing in this Agreement obligates Evolve to disclose any particular information or to continue providing access to the Platform.

## 10. Assignment & Successors

You may not assign or transfer this Agreement. Evolve may freely assign this Agreement. This Agreement binds and benefits the parties and their permitted successors.

## 11. Governing Law

This Agreement is governed by the laws of the jurisdiction in which Evolve Foundation is established, without regard to conflict-of-laws principles. You consent to the exclusive jurisdiction and venue of the competent courts of that jurisdiction for any dispute arising out of or relating to this Agreement.

## 12. Entire Agreement; Severability; Updates

This Agreement, together with the Platform's Terms of Service and Privacy Policy, constitutes the entire agreement between you and Evolve regarding its subject matter. If any provision is held unenforceable, the remainder shall remain in full force and effect. Evolve may publish updated versions of this NDA; you will be required to re-accept the updated version to continue using the Platform.

## 13. Reporting Suspected Breaches

Please report any suspected breach, leak, or unauthorized access immediately to: **admin@evolvefoundation.us**

---

**By clicking "I Accept" you confirm that you have read, understood, and agree to be legally bound by every provision of this Non-Disclosure & Non-Use Agreement.**
$md$,
  true,
  now()
);
