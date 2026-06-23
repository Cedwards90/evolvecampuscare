-- Community Resources
CREATE TABLE public.community_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  name text NOT NULL,
  address text,
  website text,
  contact text,
  phone text,
  description text,
  tags text[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.community_resources TO authenticated;
GRANT ALL ON public.community_resources TO service_role;
ALTER TABLE public.community_resources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read active resources"
  ON public.community_resources FOR SELECT TO authenticated
  USING (is_active OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage resources"
  ON public.community_resources FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER trg_community_resources_updated
  BEFORE UPDATE ON public.community_resources
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_community_resources_category ON public.community_resources(category) WHERE is_active;

-- Recommendations
CREATE TABLE public.resource_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  resource_id uuid NOT NULL REFERENCES public.community_resources(id) ON DELETE CASCADE,
  source text NOT NULL CHECK (source IN ('intake','request','manual')),
  request_id uuid REFERENCES public.support_requests(id) ON DELETE SET NULL,
  reason text,
  created_by uuid,
  dismissed_at timestamptz,
  clicked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.resource_recommendations TO authenticated;
GRANT ALL ON public.resource_recommendations TO service_role;
ALTER TABLE public.resource_recommendations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students read own recs"
  ON public.resource_recommendations FOR SELECT TO authenticated
  USING (
    student_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.can_staff_manage_student(auth.uid(), student_id)
  );
CREATE POLICY "Students update own recs"
  ON public.resource_recommendations FOR UPDATE TO authenticated
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());
CREATE POLICY "Staff insert recs"
  ON public.resource_recommendations FOR INSERT TO authenticated
  WITH CHECK (
    student_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.can_staff_manage_student(auth.uid(), student_id)
  );
CREATE POLICY "Admins delete recs"
  ON public.resource_recommendations FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE INDEX idx_recs_student ON public.resource_recommendations(student_id, created_at DESC);

INSERT INTO public.community_resources (category, name, address, website, contact, phone) VALUES
('Basic Needs & Stability', 'Greater Chicago Food Depository', '4100 W Ann Lurie Pl, Chicago, IL 60632', 'https://chicagosfoodbank.org/', 'https://www.chicagosfoodbank.org/contact/', '(773) 247-3663'),
('Basic Needs & Stability', 'Common Pantry', '3908 N Lincoln Ave, Chicago, IL 60613', 'http://commonpantry.org/', 'director@commonpantry.org', '(773) 327-0553'),
('Basic Needs & Stability', 'Irving Park Community Food Pantry', '4256 N Ridgeway Ave, Chicago, IL 60618', 'https://irvingparkfoodpantry.com/', 'info@irvingparkfoodpantry.org', '(773) 283-6296'),
('Basic Needs & Stability', 'Pilsen Food Pantry', '2124 S Ashland Ave, Chicago, IL 60608', 'http://pilsenfoodpantry.com/', 'info@pilsenfoodpantry.com', '(773) 812-3150'),
('Basic Needs & Stability', 'The Friendship Center', '2711 W Lawrence Ave, Chicago, IL 60625', 'https://friendshipcenterchicago.org', 'info@friendshipcenterchicago.org', '(773) 907-6388'),
('Basic Needs & Stability', 'St Cyprian’s Food Pantry', '6535 W Irving Park Rd, Chicago, IL 60634', 'https://www.unitedinfaith.org/st-cyprians-food-pantry', NULL, '(773) 283-9178'),
('Basic Needs & Stability', 'Pan de Vida Fresh Market', '2701 S Lawndale Ave, Chicago, IL 60623', 'https://newlifecenters.org/en/programs/pan-de-vida-food-distribution/', 'info@newlifecenters.org', '(312) 736-2466'),
('Basic Needs & Stability', 'A Just Harvest', '7653 N Paulina St, Chicago, IL 60626', 'https://ajustharvest.org/', 'info@ajustharvest.org', '(773) 262-2297'),
('Basic Needs & Stability', 'Nourishing Hope Chicago', '1716 W Hubbard St, Chicago, IL 60622', 'https://nourishinghopechi.org/', 'https://nourishinghopechi.org/contact/', '(773) 525-1777'),
('Basic Needs & Stability', 'Breakthrough Fresh Market', '1400 W 95th St, Chicago, IL 60643', 'https://breakthrough.org/programs/fresh-market', 'info@breakthrough.org', '(773) 722-7440'),
('Basic Needs & Stability', 'The Love Fridge Chicago', 'Multiple locations throughout Chicago', 'https://www.thelovefridge.com/', 'thelovefridgechicago@gmail.com', NULL),
('Basic Needs & Stability', 'Circle Urban Ministries', '118 N Central Ave, Chicago, IL 60644', 'https://circleurban.org/', 'info@circleurban.org', '(773) 921-1446'),
('Basic Needs & Stability', 'Marillac Social Center Food Pantry', '2859 W Jackson Blvd, Chicago, IL 60612', 'https://msvchicago.org/the-harvest-hub/', 'communications@marillacstvincent.org', '(773) 584-4539'),
('Basic Needs & Stability', 'Mission of Our Lady of the Angels Pantry', '3814 W Iowa St, Chicago, IL 60651', 'https://missionola.com/outreach_AssistPoor_FoodPantry.html', 'olamission@gmail.com', '(773) 486-8439'),
('Basic Needs & Stability', 'Ravenswood Community Services', '4550 N Hermitage Ave, Chicago, IL 60640', 'https://www.ravenswoodcommunityservices.org', 'info@ravenswoodcommunityservices.org', '(773) 769-0282'),
('Basic Needs & Stability', 'Care for Real', '5339 N Sheridan Rd, Chicago, IL 60640', 'https://www.careforreal.org', 'info@careforreal.org', '(773) 769-6182'),
('Basic Needs & Stability', 'St. Sabina Church Food Pantry', '1210 W 78th Pl, Chicago, IL 60620', 'https://saintsabina.org/', 'info@stsabina.org', '(773) 483-4300'),
('Basic Needs & Stability', 'Greater Englewood Community Development Corporation', '815 W 63rd St, Chicago, IL 60621', 'https://gecdc.org', 'info@gecdc.org', '(773) 994-4600'),
('Basic Needs & Stability', 'New Life Centers of Chicagoland', '2657 S Lawndale Ave, Chicago, IL 60623', 'https://newlifecenters.org', 'info@newlifecenters.org', '(773) 838-9470'),
('Basic Needs & Stability', 'Centro Romero', '6216 N Clark St, Chicago, IL 60660', 'https://centroromero.org', 'info@centroromero.org', '(773) 508-5300'),
('Basic Needs & Stability', 'A Safe Haven Foundation Food Pantry', '2750 W Roosevelt Rd, Chicago, IL 60608', 'https://www.asafehaven.org/foodpantryandnutrition/', 'info@asafehaven.org', '(773) 435-8300'),
('Basic Needs & Stability', 'Salvation Army Harbor Light Corps Freedom Center Food Pantry', '825 N Christiana Ave, Chicago, IL 60651', 'https://centralusa.salvationarmy.org/freedom/cure-hunger/', 'tsafreedomcorps@gmail.com', '(312) 667-2200'),
('Basic Needs & Stability', 'Sanad Organization - Food Distribution Center', '3302 W 63rd St, Chicago, IL 60629', NULL, NULL, '(773) 436-7989'),
('Housing & Stability', 'Law Center for Better Housing', '100 N LaSalle St, Suite 600, Chicago, IL 60602', 'https://lcbh.org', 'info@lcbh.org', '(312) 347-7600'),
('Housing & Stability', 'All Chicago Making Homelessness History', '651 W Washington Blvd, Suite 504, Chicago, IL 60661', 'https://allchicago.org', 'info@allchicago.org', '(312) 379-0301'),
('Housing & Stability', 'Chicago Housing Authority', '60 E Van Buren St, Chicago, IL 60605', 'https://thecha.org', 'chaceteam@thecha.org', '(312) 742-8500'),
('Housing & Stability', 'Neighborhood Housing Services of Chicago', '850 W. Jackson Blvd., 5th Floor, Chicago, IL 60607', 'https://nhschicago.org', 'homeownership@nhschicago.org', '(773) 329-4111'),
('Housing & Stability', 'Housing Action Illinois', '67 E Madison St, Suite 1603, Chicago, IL 60603', 'https://housingactionil.org', 'info@housingactionil.org', '(312) 939-6074'),
('Housing & Stability', 'Chicago Low-Income Housing Trust Fund', '33 N LaSalle St, Suite 2900, Chicago, IL 60602', 'https://clihtf.org', 'info@clihtf.org', '(312) 742-0820'),
('Housing & Stability', 'Deborah’s Place', '2822 W Jackson Blvd, Chicago, IL 60612', 'https://deborahsplace.org', 'info@deborahsplace.org', '(773) 722-5080'),
('Housing & Stability', 'Northside Housing and Supportive Services', '4410 N Ravenswood Ave, Chicago, IL 60640', 'https://northsidehousing.org', 'development@northsidehousing.org', '(773) 244-6401'),
('Housing & Stability', 'AIDS Foundation of Chicago', '200 W Jackson Blvd, Suite 2200, Chicago, IL 60606', 'https://aidschicago.org', 'communications@aidschicago.org', '(312) 922-2322'),
('Housing & Stability', 'Access Living', '115 W Chicago Ave, Chicago, IL 60654', 'https://accessliving.org', 'info@accessliving.org', '(312) 640-2100'),
('Housing & Stability', 'Bickerdike Redevelopment Corporation', '2550 W North Ave, Chicago, IL 60647', 'https://bickerdike.org', 'information@bickerdike.org', '(773) 278-5669'),
('Housing & Stability', 'Breakthrough Urban Ministries', '402 N St Louis Ave, Chicago, IL 60624', 'https://breakthrough.org', 'info@breakthrough.org', '(773) 722-1144'),
('Housing & Stability', 'The Resurrection Project', '1805 S Paulina St, Chicago, IL 60608', 'https://resurrectionproject.org', 'Contact Us | The Resurrection Project', '(312) 666-1323'),
('Housing & Stability', 'Spanish Coalition for Housing', '1922 N Pulaski Rd, Chicago, IL 60639', 'https://sc4housing.org', 'help@sc4housing.org', '(773) 342-7575'),
('Housing & Stability', 'Sarah’s Circle', '4838 N Sheridan Rd, Chicago, IL 60640', 'https://sarahs-circle.org', 'Contact - Sarah''s Circle', '(773) 728-1991'),
('Housing & Stability', 'Connections for the Homeless', '2121 Dewey Ave, Evanston, IL 60201', 'https://connect2home.org', 'info@connect2home.org', '(847) 475-7070'),
('Housing & Stability', 'Franciscan Outreach', '1645 W LeMoyne St, Chicago, IL 60622', 'https://franoutreach.org', 'geninfo@franoutreach.org', '(773) 278-6724'),
('Housing & Stability', 'Featherfist', '2255 E. 75th Street', 'https://featherfist.org', 'Contact – Featherfist', '773-721-7088'),
('Housing & Stability', 'La Casa Norte', '3533 W North Ave, Chicago, IL 60647', 'https://lacasanorte.org', 'info@lacasanorte.org', '(773) 276-4900'),
('Housing & Stability', 'Community Investment Corporation', '222 S. Riverside Plaza Suite 380', 'https://cicchicago.com', 'info@cicchicago.com', '(312) 258-0070'),
('Housing & Stability', 'Claretian Associates', '3039 East 91st Street Chicago, IL 60617', 'https://claretianassociates.org', 'info@claretianassociates.org', '(773) 734-9181'),
('Housing & Stability', 'POAH Chicago', '33 N. Dearborn, Suite 1500 Chicago, IL 60602', 'https://poahchicago.org', NULL, '312.283.0031'),
('Housing & Stability', 'Chicago Coalition for the Homeless', '70 E Lake St, Suite 720, Chicago, IL 60601', 'https://chicagohomeless.org', 'info@chicagohomeless.org', '(312) 641-4140'),
('Housing & Stability', 'Cornerstone Community Outreach', '4628 N Clifton Ave, Chicago, IL 60640', 'https://ccolife.org', 'info@ccolife.org', '(773) 271-8163'),
('Housing & Stability', 'The Night Ministry', '1735 N Ashland Ave, Suite 2000, Chicago, IL 60622', 'https://thenightministry.org', 'info@thenightministry.org', '(773) 784-9000'),
('Housing & Stability', 'Volunteers of America Illinois', '47 W Polk St, Suite 250, Chicago, IL 60605', 'https://voaillinois.org', 'info@voaillinois.org', '(312) 564-2300'),
('Housing & Stability', 'Housing Opportunities for Women', '1607 W Howard St, Chicago, IL 60626', 'https://how-inc.org', 'info@how-inc.org', '773-465-5770'),
('Housing & Stability', 'Renaissance Social Services', '2501 W. Washington Blvd., Suite 401 Chicago, IL 60612', 'https://rssichicago.org', 'Contact Renaissance Social Services Chicago | Get Help & Support', '773.645.8900'),
('Housing & Stability', 'Thresholds', '4101 N Ravenswood Ave, Chicago, IL 60613', 'https://thresholds.org', 'thresholds@thresholds.org', '(773) 572-5500'),
('Housing & Stability', 'Covenant House', '2934 W. Lake St, Chicago, IL 60612', 'https://covenanthouse.org', 'mcooley@covenanthouse.org', '312-759-7878'),
('Housing & Stability', 'Lincoln Park Community Services', '600 W Fullerton Pkwy, Chicago, IL 60614', 'https://lpcschicago.org', 'info@lpcschicago.org', '(773) 549-6111'),
('Legal & Reentry Support', 'Legal Aid Chicago', '200 N LaSalle St, Ste 1400, Chicago, IL 60601', 'https://legalaidchicago.org', 'communityengagement@legalaidchicago.org', '(312) 341-1070'),
('Legal & Reentry Support', 'Chicago Volunteer Legal Services', '33 N Dearborn St, Suite 400, Chicago, IL 60602', 'https://www.cvls.org', 'info@cvls.org', '(312) 332-1624'),
('Legal & Reentry Support', 'Law Center for Better Housing', '100 N LaSalle St, Suite 600, Chicago, IL 60602', 'https://lcbh.org', 'They do not respond to email requests.', '(312) 347-7600'),
('Legal & Reentry Support', 'Greater Chicago Legal Clinic', '17 N State St, Suite 1710, Chicago, IL 60602', 'https://www.gclclaw.org', 'intake@gclclaw.org', '(312) 726-2938'),
('Legal & Reentry Support', 'National Immigrant Justice Center', '111 W. Jackson Blvd., Suite 800, Chicago, IL 60604', 'https://immigrantjustice.org', 'https://immigrantjustice.org/contact-us/', '(312) 660-1370'),
('Legal & Reentry Support', 'Cook County Legal Aid for Housing & Debt', '33 N Dearborn St, Suite 400, Chicago, IL 60602', 'https://www.cookcountylegalaid.org/', 'socialmediacc@cookcountyil.gov', '(312) 443-5500'),
('Legal & Reentry Support', 'CARPLS', '35 E Wacker Dr, Suite 3000, Chicago, IL 60601', 'https://www.carpls.org', 'info@carpls.org', '(312) 738-9200'),
('Legal & Reentry Support', 'Illinois Access to Justice', '1818 S. Paulina Ave', 'https://ilaccesstojustice.com', NULL, '(312) 666-1323'),
('Legal & Reentry Support', 'Illinois Reentry Council', '1 S Dearborn St, Suite 1510, Chicago, IL 60603', 'https://illinoisreentrycouncil.org', 'irc@iljp.org', '(312) 332-8157'),
('Legal & Reentry Support', 'Safer Foundation', '571 W Jackson Blvd, Chicago, IL 60661', 'https://saferfoundation.org', 'https://saferfoundation.org/contact/', '(312) 922-2200'),
('Legal & Reentry Support', 'Project HOOD', '6620 S King Dr, Chicago, IL 60637', 'https://projecthood.org', 'info@projecthood.org', '(773) 923-8270'),
('Legal & Reentry Support', 'Westside Health Authority', '5500 W. Madison Street Chicago, IL 60644', 'https://healthauthority.org', 'info@healthauthority.org', '(312) 738-2452'),
('Legal & Reentry Support', 'ABC Reentry', '53 W Jackson Blvd, Suite 315, Chicago, IL 60604', 'https://www.abcreentry.org', 'ashley@abcreentry.org', NULL),
('Legal & Reentry Support', 'Illinois Alliance for Reentry & Justice', '3015 E. New York Street, Suite #A2-163 Aurora, IL 60504', 'https://www.ilarj.org', 'contact@ilarj.org', NULL),
('Legal & Reentry Support', 'Cabrini Green Legal Aid', '6 S Clark St. Chicago, IL 60603', 'https://www.cgla.net', 'info@cgla.net', '(312) 738-2452'),
('Workforce & Economic Empowerment', 'Chicago Cook Workforce Partnership', '1 N Dearborn St, Ste 750, Chicago, IL 60602', 'https://chicookworks.org', 'https://chicookworks.org/contact-us/', '(708) 580-8686'),
('Workforce & Economic Empowerment', 'Work Ready Chicago', '8120 S Kedzie Ave, Ste 2, Chicago, IL 60652', 'https://workreadychi.org', 'info@workreadychi.org', NULL),
('Workforce & Economic Empowerment', 'Chicago Urban League - Employment Services', '4510 S Michigan Ave, Chicago, IL 60653', 'https://chiul.org/employment-services/', 'success@chiul.org', '(773) 285-5800'),
('Workforce & Economic Empowerment', 'Women Employed', '67 E. Madison, Suite 2000, Chicago, Illinois 60603', 'https://womenemployed.org', 'info@womenemployed.org', '(312) 782-3902'),
('Workforce & Economic Empowerment', 'YWCA Metropolitan Chicago', '1 North LaSalle Street, Suite 1700 Chicago, IL 60602', 'https://ywcachicago.org', 'info@ywcachicago.org', '(866) 525-9922'),
('Workforce & Economic Empowerment', 'Skills for Chicago', '815 W. 63rd St. 2nd Floor', 'https://skillsforchicago.org', 'https://skillsforchicago.org/contact-us/', '312-906-7200'),
('Workforce & Economic Empowerment', 'One Million Degrees', '180 N. Wabash Suite 415, Chicago, IL  60601', 'https://onemilliondegrees.org', 'info@onemilliondegrees.org', '(312) 920-9605'),
('Workforce & Economic Empowerment', 'My Block, My Hood, My City', '47 w polk st, Chicago, IL, United States, Illinois', 'https://www.formyblock.org', 'info@mbmhmc.com', NULL),
('Workforce & Economic Empowerment', 'UCAN Workforce & Youth Development', '5101 S King Dr, Chicago, IL 60615', 'https://www.ucan.org', 'https://www.ucan.org/contact-us/', NULL),
('Workforce & Economic Empowerment', 'After School Matters', '66 E Randolph St., Chicago, IL 60601', 'https://www.afterschoolmatters.org', 'info@afterschoolmatters.org', '312-768-5200'),
('Workforce & Economic Empowerment', 'Association House Workforce Services', '1116 N Kedzie Blvd, Chicago, IL 60651', 'https://www.associationhouse.org', 'https://www.associationhouse.org/contact', '(773) 772-7170'),
('Transportation Services', 'Active Transportation Alliance', '35 E Wacker Dr, Ste 1782, Chicago, IL 60601', 'https://activetrans.org', 'info@activetrans.org', '(312) 427-3325'),
('Transportation Services', 'Safe Haven Transit', 'Matteson, IL 60443', 'https://safehaventransit.com', 'safehaventransit@gmail.com', '(773) 961-6416'),
('Transportation Services', 'Not-for-Profit Shuttle (Pace Shuttle Program)', '550. W. Algonquin Rd., Arlington Heights, IL', 'https://www.pacebus.com/not-profit-shuttle', 'passenger.services@pacebus.com', '(847) 364-7223'),
('Transportation Services', 'Open Communities (Transit Equity Work)', '1740 Ridge Avenue, Suite 117, Evanston, IL 60201', 'https://open-communities.org', 'info@open-communities.org', '847.501.5760'),
('Transportation Services', 'Grow Greater Englewood (with transit equity work)', '6533 South Stewart, Chicago, IL 60621', 'https://www.growgreater.org/', 'connect@growgreater.org', NULL),
('Health & Wellness', 'Infant Welfare Society of Chicago', '3600 W Fullerton Ave, Chicago, IL 60647', 'https://infantwelfaresociety.org', 'info@infantwelfare.org', '(773) 484-9899'),
('Health & Wellness', 'The Kedzie Center', '4141 N. Kedzie Ave. Suite 2', 'https://thekedziecenter.org', 'info@thekedziecenter.org', '773-754-0577'),
('Health & Wellness', 'Pillars Community Health', '5220 East Ave, Countryside, IL 60525', 'https://pillarscommunityhealth.org', 'info@pillarscommunityhealth.org', '(708) 745-5277'),
('Health & Wellness', 'Saint Anthony Hospital Community Wellness Program', '2875 W 19th St, Chicago, IL 60623', 'https://sahchicago.org/community-outreach', 'info@sahchicago.org', '(773) 484-4080'),
('Health & Wellness', 'Habilitative Systems, Inc.', '415 S Kilpatrick Ave, Chicago, IL 60644', 'https://www.habilitative.org', 'hsi@habilitative.org', '(773) 261-2252'),
('Health & Wellness', 'Human Resources Development Institute', '33 E 114th St, Chicago, IL 60628', 'https://www.hrdi.org', 'info@hrdi.org', '773-261-2252'),
('Health & Wellness', 'Infant Welfare Society of Chicago – South Site', '7415 S East End Ave, Chicago, IL 60649', 'https://infantwelfaresociety.org', 'hello@iwsfamilyhealth.org', '(773) 782-2800'),
('Health & Wellness', 'Healthy Hood Chicago', '2242 S Damen Ave, Chicago, IL', 'https://www.healthyhoodchi.com', 'https://www.healthyhoodchi.com/contact', '(773) 876-0317'),
('Health & Wellness', 'Wellness West', '180 N. Stetson, Suite 600-1, Chicago, Illinois 60601', 'https://wellnesswest.org', 'wellnesswest@mhnchicago.org', '(312) 967-1920'),
('Health & Wellness', 'Chicago Partnership for Health Promotion (UIC)', '818 S Wolcott Ave, Chicago, IL 60612', 'https://cphp.uic.edu', 'cphpservices@uic.edu', '(312) 355-3659'),
('Health & Wellness', 'The Alliance for Health Equity', '310 S Peoria Street, Suite 404 Chicago, IL 60607', 'https://www.allhealthequity.org', 'https://www.allhealthequity.org/contact', '(312) 850-4744'),
('Health & Wellness', 'Greater Auburn Gresham Development Corporation (Health & Wellness Programs)', '839 W 79th St, Chicago, IL 60620', 'https://www.gagdc.org/health-wellness', 'info@gagdc.org', '(773) 483-3696'),
('Health & Wellness', 'CALOR Walk-In Clinic', '3201 W North Ave Chicago, IL 60647', 'https://calor.org', 'aflores@calor.org', '(773) 385-9080'),
('Health & Wellness', 'Chicago Help Initiative — Health & Wellness Programs', '440 N Wells St, Suite 440, Chicago, IL', 'https://www.chicagohelpinitiative.org', 'https://chicagohelpinitiative.org/contact', '(312) 448-0045'),
('Health & Wellness', 'Pilsen Wellness Center', '2319 South Damen Avenue, Chicago, Illinois 60608', 'http://pilsenwellnesscenter.org', NULL, '773-579-0832'),
('Health & Wellness', 'Chicago Abortion Fund (Wellness & Support)', '333 W. North Ave, Ste. 267 Chicago, IL 60610', 'https://www.chicagoabortionfund.org', 'info@chicagoabortionfund.org', '312-663-0338'),
('Health & Wellness', 'Project SALSA (Substance Awareness & Support)', '4700 S. California Ave.', 'https://www.projectsalsa.org', NULL, '773-916-4436'),
('Health & Wellness', 'Chicago Womens Health Center', '1025 W. Sunnyside Ave., Suite 201 Chicago, Illinois 60640', 'https://www.chicagowomenshealthcenter.org', 'info@cwhc.org', '(773) 935-6126'),
('Health & Wellness', 'Urban Growers Collective (Wellness & Nutrition)', '1200 W. 35th St. #118, Chicago, IL 60609', 'https://www.urbangrowerscollective.org', 'info@urbangrowerscollective.org', '(773) 376-8862'),
('Health & Wellness', 'HRDI (Behavioral Health)', '33 E 114th St, Chicago, IL 60628', 'https://www.hrdi.org', 'info@hrdi.org', '773-291-2500'),
('Youth & Family Services', 'Youth Outreach Services', '2411 W Congress Pkwy, Chicago, IL 60612', 'https://www.yos.org', 'info@yos.org', '(773) 777-7112'),
('Youth & Family Services', 'SGA Youth & Family Services', '11 E. Adams St., Ste. 240 Chicago, IL 60603', 'https://sga-youth.org', 'hello@sga-youth.org', '(312) 663-0305'),
('Youth & Family Services', 'JCFS Chicago', '230 W. Monroe, Suite 1100, Chicago, IL 60606', 'https://www.jcfs.org', 'ask@jcfs.org', '312.357.4800'),
('Youth & Family Services', 'Chicago Youth Centers', '218 S Wabash Ave, Suite 510, Chicago, IL 60604', 'https://www.chicagoyouthcenters.org', 'info@chicagoyouthcenters.org', '(312) 913-1700'),
('Youth & Family Services', 'The Black Star Project', '3509 South King Dr., Ste. 2B, Chicago, IL 60653', 'https://blackstarproject.org', 'communityinfo@blackstarproject.org', '(773) 285-9600'),
('Youth & Family Services', 'Big Brothers Big Sisters of Metropolitan Chicago', '130 S. Jefferson St. Suite 200, Chicago, IL. 60661', 'https://bbbschgo.org', 'bbbschgo@bbbschgo.org', '312.207.5600'),
('Youth & Family Services', 'iMentor Chicago', '20 N Wacker Dr, 12th Floor, Chicago, IL 60606', 'https://www.imentor.org', 'chicago@imentor.org', '(312) 805-0503'),
('Youth & Family Services', 'Childrens Place Association', '11 E. Adams, Suite 1550, Chicago, IL 60603', 'https://www.childrens-place.org', 'social@childrens-place.org', '312-733-9954'),
('Youth & Family Services', 'UCAN Youth Services', '3605 W Fillmore St, Chicago, IL 60624', 'https://www.ucanchicago.org', 'info@ucanchicago.org', '(773) 588-0180'),
('Youth & Family Services', 'BUILD Chicago', '5100 W. Harrison St., Chicago, IL 60644', 'https://www.buildchicago.org', 'build@buildchicago.org', '(773) 227-2880'),
('Youth & Family Services', 'Open Books Youth Literacy Programs', 'Chicago, IL', 'https://openbooks.org', 'community@openbooks.org', NULL),
('Youth & Family Services', 'Young Chicago Authors', '1180 N Milwaukee Ave, Chicago, IL 60642', 'https://youngchicagoauthors.org', 'https://airtable.com/appLsus9uU07HNwV6/shrRQiGjwtwDhtvQF', '(773) 486-4331'),
('Youth & Family Services', 'Urban Gateways', '1637 N Ashland Ave Ste 1, Chicago, IL 60622', 'https://www.urbangateways.org', 'mwoods@urbangateways.org', '312.922.0440'),
('Youth & Family Services', 'Chicago Youth Symphony Orchestras', '410 S. Michigan Avenue, Suite 833, Chicago, IL 60605', 'https://www.cyso.org', 'info@cyso.org', '312-939-2207'),
('Youth & Family Services', 'Chicago Scholars Youth Programs', '247 S. State Street, Suite 700, Chicago, IL 60604', 'https://www.chicagoscholars.org', 'thankyou@chicagoscholars.org', '312.784.3300'),
('Youth & Family Services', 'Little Friends Youth Services', '27555 Diehl Road, Warrenville, IL 60555', 'https://www.littlefriendsinc.org', 'info@lilfriends.com', '630.355.6533'),
('Youth & Family Services', 'ProjectExploration', '4511 S Evans Ave, Chicago, IL', 'https://www.projectexploration.org', 'mail@projectexploration.org', '(312) 273-4026'),
('Youth & Family Services', 'Teamwork Englewood', '815 W 63rd St, Floor # 2, Chicago, IL 60621', 'https://teamworkenglewood.org', 'info@teamworkenglewood.org', '(773) 488 - 6600'),
('Senior Services', 'Chicago Commons Senior Services', '515 East 50th Street, Suite 200, Chicago, IL 60615', 'https://www.chicagocommons.org/programs/senior-services/', 'info@chicagocommons.org', '(773) 373-5055'),
('Senior Services', 'Edgewater Village Chicago', '5917 N. Broadway, Chicago, IL 60660', 'https://www.evchicago.org', 'info@evchicago.org', '773-609-4047'),
('Senior Services', 'Chicago Methodist Senior Services', '5520 N. Paulina St., Chicago, IL 60640', 'https://www.cmsschicago.org', 'info@cmsschicago.org', '773-596-2233'),
('Senior Services', 'Alivio Medical Center Senior Services', '2021 S Morgan St, Chicago, IL 60608', 'https://alivio.org/programs/seniors/', 'https://alivio.org/contact/', '(773) 254-1400'),
('Senior Services', 'Norwood Life Society', '6016-20 N Nina Ave, Chicago, IL 60631', 'https://www.reshapingaging.org', 'https://www.reshapingaging.org/more-information', '(773) 631-4856'),
('Senior Services', 'Atlas 79th Street Senior Center', '1769 W 79th St, Chicago, IL 60620', 'https://www.79thstreetseniors.org', 'https://www.79thstreetseniors.org/contactus', '(312) 747-0189'),
('Senior Services', 'CJE SeniorLife', '3003 W. Touhy Ave., Chicago, IL 60645', 'https://www.cje.net', 'info@cje.net', '773.508.1000'),
('Senior Services', 'Chicago Senior Resource Agency', 'Chicago, IL', 'https://chicagosra.com', NULL, '(312) 966-5775'),
('Senior Services', 'City of Chicago Senior Services (Area Agency on Aging)', '1615 W. Chicago Ave, 5th Floor, Chicago, IL 60622-5127', 'https://www.chicago.gov/aging', NULL, '(312) 744-4016'),
('Senior Services', 'Meals on Wheels Chicago', '314 W Superior St #201, Chicago, IL 60654', 'https://www.mealsonwheelschicago.org', 'info@mealsonwheelschicago.org', '(773) 661-4550'),
('Senior Services', 'Center on Halsted Senior Services', '3656 N Halsted Street, Chicago, IL', 'https://centeronhalsted.org', 'pr@centeronhalsted.org', '(773) 472-6469'),
('Senior Services', 'Chinese American Service League Senior Programs', '2141 South Tan Court, Chicago IL 60616', 'https://www.caslservice.org', 'https://casl.org/contact-us', '(312) 791-0418'),
('Senior Services', 'American Indian Center Senior Programs', '3401 W. Ainslie st, Chicago, IL', 'https://aicchicago.org', 'info@chicagoaic.org', '(773) 275-5871'),
('Senior Services', 'AgeOptions (senior support & benefits)', '1048 Lake Street, Suite 300, Oak Park, IL 60301', 'https://www.ageoptions.org', 'information@ageoptions.org', '708-383-0258'),
('Senior Services', 'Metropolitan Family Services – Senior Support', '101 North Wacker Drive, 17th Floor Chicago, IL 60606', 'https://www.metrofamily.org', 'contactus@metrofamily.org', '312-986-4000'),
('Senior Services', 'Alzheimer’s Association – Greater Illinois Chapter', '225 N Michigan Ave. Floor 17 Chicago, IL 60601', 'https://www.alz.org/illinois', 'https://www.alz.org/contact-us', '800.272.3900'),
('Community & Civic Engagement', 'Chicago Votes', '1006 S Michigan Ave #606, Chicago, IL 60605', 'https://chicagovotes.com/', 'info@chicagovotes.com', NULL),
('Community & Civic Engagement', 'Chicago Coalition for the Homeless', '70 E Lake St, Ste 720, Chicago, IL 60601', 'https://www.chicagohomeless.org', 'info@chicagohomeless.org', '(312) 641-4140'),
('Community & Civic Engagement', 'Illinois Coalition for Immigrant and Refugee Rights', '228 S. Wabash, Suite 800, Chicago, Illinois 60604', 'https://icirr.org', 'info@icirr.org', '312-332-7360'),
('Community & Civic Engagement', 'Chicago Community Trust', '33 S. State Street, Suite 750, Chicago, IL 60603', 'https://www.cct.org', 'info@cct.org', '312-616-8000'),
('Community & Civic Engagement', 'Citizens Utility Board (CUB)', '309 West Washington Street, Suite 800, Chicago, Illinois 60606', 'https://www.citizensutilityboard.org', 'support@citizensutilityboard.org', '(312) 263-4282'),
('Community & Civic Engagement', 'Chicago Immigration Law Project', '25 E. Washington Street, Suite 1300 Chicago, IL 60602', 'https://www.clccrul.org', 'info@clccrul.org', '(312) 630-9744'),
('Community & Civic Engagement', 'Urban League of Metropolitan Chicago – Civic Engagement', '4510 S. Michigan Avenue Chicago, IL 60653', 'https://chiul.org', 'https://chiul.org/contact/', '(773) 285-5800'),
('Community & Civic Engagement', 'North River Commission', '3403 W Lawrence Ave #301 Chicago, IL 60625', 'https://www.northrivercommission.org', 'info@northrivercommission.org', '773-478-0202'),
('Community & Civic Engagement', 'Bucktown Community Organization', '1658 N Milwaikee #520, Chicago, Illinois 60647', 'https://www.bucktown.org', 'info@bucktown.org', NULL),
('Community & Civic Engagement', 'Hyde Park Neighborhood Club', '1507 East 53rd Street, #404 Chicago, IL 60615', 'https://www.hydepark.org', 'info@hydepark.org', '(708) 297-4926'),
('Community & Civic Engagement', 'Northalsted Business Alliance', '3656 N. Halsted Street, Chicago, IL 60613', 'https://www.northalsted.com', 'info@northalsted.com', '(773) 883-0500'),
('Community & Civic Engagement', 'The 606 Neighborhood Group', 'Ridgeway & Bloomingdale, Chicago, IL', 'https://www.the606.org', 'info@the606.org', '(312) 742-4622'),
('Community & Civic Engagement', 'Chicagoland Chamber of Commerce', '410 North Michigan Avenue, Ste 900 Chicago, IL 60611', 'https://www.chicagolandchamber.org', 'info@chicagolandchamber.org', '(312) 494 6700'),
('Community & Civic Engagement', 'Chicago Federation of Labor (Community Work)', '180 N. Stetson Ave., Suite 1529, Chicago, IL 60601', 'https://www.chicagolabor.org', 'info@chicagolabor.org', '(312) 222-1000'),
('Community & Civic Engagement', 'Southwest Organizing Project', '2558 W. 63rd St., Chicago, IL 60629', 'https://swopchicago.org', 'info@swopchicago.org', '(773) 471-8208'),
('Community & Civic Engagement', 'Westside United', '906 S Homan Ave, Chicago IL 60624', 'https://westsideunited.org', 'https://www.westsideunited.org/work-with-us', NULL),
('Community & Civic Engagement', 'Neighborhood Housing Services of Chicago – Community Engagement', '850 W. Jackson Blvd., 5th Floor, Chicago, IL 60607', 'https://nhschicago.org', 'homeownership@nhschicago.org', '(773) 329-4111');