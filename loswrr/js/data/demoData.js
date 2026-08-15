/* ==========================================================================
   LOSWRR Demo Data
   Used only when external services are not configured.
   Always clearly labeled as DEMO DATA in the UI.
   ========================================================================== */
(function (global) {
  'use strict';

  const demoJobs = [
    {
      id: 'dj-1', company: 'Helios Remote Co.', position: 'Customer Support Specialist',
      location: 'Remote (US)', salary: '$850–$1,100 / mo', type: 'Full-time',
      description: 'Handle inbound customer queries via chat and email for a SaaS platform. Rotational shifts including weekends.',
      skills: ['English', 'Zendesk', 'Communication', 'SaaS'],
      url: 'https://example.com/jobs/dj-1', matchScore: 92, status: 'NEW',
    },
    {
      id: 'dj-2', company: 'NorthPeak Solutions', position: 'Customer Success Associate',
      location: 'Remote (Worldwide)', salary: '$900–$1,300 / mo', type: 'Full-time',
      description: 'Onboard new B2B customers, drive product adoption, and surface expansion opportunities.',
      skills: ['Onboarding', 'SaaS', 'Communication', 'CRM'],
      url: 'https://example.com/jobs/dj-2', matchScore: 88, status: 'NEW',
    },
    {
      id: 'dj-3', company: 'Stratus Logistics', position: 'Remote Support Engineer',
      location: 'Remote (EU)', salary: '€1,000–€1,400 / mo', type: 'Full-time',
      description: 'Tier 1 technical support for logistics customers. Troubleshooting APIs and routing issues.',
      skills: ['Linux', 'API', 'Troubleshooting', 'English'],
      url: 'https://example.com/jobs/dj-3', matchScore: 84, status: 'NEW',
    },
    {
      id: 'dj-4', company: 'Lumen Health', position: 'Patient Support Coordinator',
      location: 'Remote (US)', salary: '$1,000–$1,200 / mo', type: 'Full-time',
      description: 'Coordinate care plans with patients via secure messaging. HIPAA training provided.',
      skills: ['Healthcare', 'Communication', 'Slack', 'HIPAA'],
      url: 'https://example.com/jobs/dj-4', matchScore: 81, status: 'MATCHED',
    },
    {
      id: 'dj-5', company: 'Forge & Co.', position: 'E-commerce Support Agent',
      location: 'Remote (US)', salary: '$820 / mo', type: 'Contract',
      description: 'Process returns, refunds and chat support for a DTC brand on Shopify.',
      skills: ['Shopify', 'English', 'E-commerce'],
      url: 'https://example.com/jobs/dj-5', matchScore: 78, status: 'NEW',
    },
    {
      id: 'dj-6', company: 'Verdant Cloud', position: 'Technical Account Manager',
      location: 'Remote (US/EU)', salary: '$1,400–$1,800 / mo', type: 'Full-time',
      description: 'Own a portfolio of mid-market cloud customers, drive renewals and expansion.',
      skills: ['Cloud', 'Sales', 'Customer Success', 'AWS'],
      url: 'https://example.com/jobs/dj-6', matchScore: 75, status: 'NEW',
    },
    {
      id: 'dj-7', company: 'Cobalt Bank', position: 'Fraud Support Analyst',
      location: 'Remote (US)', salary: '$1,100 / mo', type: 'Full-time',
      description: 'Review flagged transactions, contact customers, and document outcomes in a regulated environment.',
      skills: ['Banking', 'Detail', 'English', 'Compliance'],
      url: 'https://example.com/jobs/dj-7', matchScore: 70, status: 'NEW',
    },
    {
      id: 'dj-8', company: 'Arcadia Learning', position: 'Student Success Advisor',
      location: 'Remote (US)', salary: '$900 / mo', type: 'Part-time',
      description: 'Advise online learners, monitor progress, and escalate to faculty when needed.',
      skills: ['Education', 'Communication', 'Slack'],
      url: 'https://example.com/jobs/dj-8', matchScore: 65, status: 'NEW',
    },
  ];

  const demoLeads = [
    {
      id: 'dl-1', company: 'Apex Roofing & Restoration', owner: 'Marcus Hale',
      contact: 'marcus@apexroofing.example', phone: '+1 (512) 555-0114',
      title: 'Owner', website: 'apexroofing.example',
      location: 'Austin, TX', industry: 'Roofing', leadScore: 92, status: 'NEW',
      notes: 'Residential and commercial, 22 employees, expanding service area.',
    },
    {
      id: 'dl-2', company: 'Lone Star Roofworks', owner: 'Diana Park',
      contact: 'diana@lonestarroof.example', phone: '+1 (713) 555-0188',
      title: 'CEO', website: 'lonestarroof.example',
      location: 'Houston, TX', industry: 'Roofing', leadScore: 89, status: 'QUALIFIED',
      notes: 'Storm restoration focus, no current CRM. Active Google ads.',
    },
    {
      id: 'dl-3', company: 'Pineywoods Roofing Co.', owner: 'Ruben Castillo',
      contact: 'ruben@pineywoodsroof.example', phone: '+1 (903) 555-0162',
      title: 'President', website: 'pineywoodsroof.example',
      location: 'Lufkin, TX', industry: 'Roofing', leadScore: 84, status: 'NEW',
      notes: 'Family-run, 12 employees, 18 years in business.',
    },
    {
      id: 'dl-4', company: 'Brazos Valley Roofing', owner: 'Alicia Nguyen',
      contact: 'alicia@brazosroof.example', phone: '+1 (979) 555-0149',
      title: 'GM', website: 'brazosroof.example',
      location: 'College Station, TX', industry: 'Roofing', leadScore: 78, status: 'CONTACTED',
      notes: 'Replied to initial outreach. Wants 30 min call next week.',
    },
    {
      id: 'dl-5', company: 'Hill Country Roof Systems', owner: 'Devon Rios',
      contact: 'devon@hillcountryroof.example', phone: '+1 (830) 555-0173',
      title: 'Owner', website: 'hillcountryroof.example',
      location: 'New Braunfels, TX', industry: 'Roofing', leadScore: 76, status: 'NEW',
      notes: 'Metal roofing specialty, 9 employees, growing.',
    },
    {
      id: 'dl-6', company: 'Gulf Coast Exteriors', owner: 'Sasha Velez',
      contact: 'sasha@gulfcoastex.example', phone: '+1 (361) 555-0156',
      title: 'Owner', website: 'gulfcoastex.example',
      location: 'Corpus Christi, TX', industry: 'Roofing', leadScore: 71, status: 'NEW',
      notes: 'Hurricane restoration surge expected Q3.',
    },
    {
      id: 'dl-7', company: 'Pampa Plains Roofing', owner: 'Theo Whitlock',
      contact: 'theo@pampaplains.example', phone: '+1 (806) 555-0124',
      title: 'Owner', website: 'pampaplainsroof.example',
      location: 'Amarillo, TX', industry: 'Roofing', leadScore: 64, status: 'NEW',
      notes: 'Rural area, fewer competitors, longer sales cycles.',
    },
    {
      id: 'dl-8', company: 'Skyline Roofing Solutions', owner: 'Iris Mahoney',
      contact: 'iris@skylineroof.example', phone: '+1 (214) 555-0102',
      title: 'COO', website: 'skylineroof.example',
      location: 'Dallas, TX', industry: 'Roofing', leadScore: 60, status: 'NEW',
      notes: 'Mid-market, 35 employees, has in-house sales team.',
    },
  ];

  const demoEmails = [
    {
      id: 'de-1', from: 'Apex Roofing <marcus@apexroofing.example>', subject: 'Re: Outbound question',
      snippet: 'Thanks for reaching out, Sir Aitzaz. Tuesday 2pm works for a quick intro call…',
      date: Date.now() - 1000 * 60 * 60 * 4, read: false, label: 'inbox',
    },
    {
      id: 'de-2', from: 'LinkedIn Jobs', subject: '5 new remote roles for you',
      snippet: 'Based on your search history, here are 5 remote jobs paying more than $800…',
      date: Date.now() - 1000 * 60 * 60 * 22, read: true, label: 'inbox',
    },
    {
      id: 'de-3', from: 'Lone Star Roofworks <diana@lonestarroof.example>', subject: 'Saw your note',
      snippet: 'Happy to chat. We do not use any CRM at the moment, but we are open to a conversation…',
      date: Date.now() - 1000 * 60 * 60 * 30, read: true, label: 'inbox',
    },
    {
      id: 'de-4', from: 'GitHub', subject: 'New release: loswrr v1.0.0',
      snippet: 'Your release loswrr v1.0.0 was published. View the release notes for what is new…',
      date: Date.now() - 1000 * 60 * 60 * 50, read: true, label: 'inbox',
    },
    {
      id: 'de-5', from: 'Stripe', subject: 'Your October payout',
      snippet: 'A payout of $1,840.22 was sent to your bank account ending in 4421…',
      date: Date.now() - 1000 * 60 * 60 * 80, read: true, label: 'inbox',
    },
  ];

  const demoPeople = [
    { id: 'dp-1', name: 'Marcus Hale', company: 'Apex Roofing', role: 'Owner', email: 'marcus@apexroofing.example', phone: '+1 (512) 555-0114', tags: ['lead', 'decision-maker'] },
    { id: 'dp-2', name: 'Diana Park', company: 'Lone Star Roofworks', role: 'CEO', email: 'diana@lonestarroof.example', phone: '+1 (713) 555-0188', tags: ['lead', 'warm'] },
  ];

  const demoProjects = [
    { id: 'dproj-1', name: 'Roofing lead engine', status: 'ACTIVE', progress: 65, notes: 'Build 50+ roofing leads per week, Texas focus.' },
    { id: 'dproj-2', name: 'Remote job search', status: 'ACTIVE', progress: 40, notes: 'Target remote customer success roles paying >$800.' },
  ];

  const sampleLeadsSchema = {
    industries: ['Roofing', 'HVAC', 'Plumbing', 'Solar', 'Insurance', 'Real Estate', 'Restoration', 'Pest Control', 'Garage Door', 'Landscaping'],
    states: ['Texas', 'California', 'Florida', 'New York', 'Illinois', 'Arizona', 'Georgia', 'North Carolina', 'Colorado', 'Washington'],
  };

  global.LDemo = {
    jobs: demoJobs,
    leads: demoLeads,
    emails: demoEmails,
    people: demoPeople,
    projects: demoProjects,
    schema: sampleLeadsSchema,
  };
})(window);
