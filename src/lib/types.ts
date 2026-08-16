// ========================================
// ACCELERATE - TYPE DEFINITIONS
// ========================================

// Navigation
export interface NavItem {
  label: string;
  href: string;
  children?: NavItem[];
}

// Services
export interface Service {
  id: string;
  name: string;
  description: string;
  shortDescription: string;
  icon: string;
  deliverables: string[];
  pricingOneTime?: string;
  pricingMonthly?: string;
  pricingDisplay: string;
  href: string;
  problemStatement: string;
  keyMetrics: { value: string; label: string }[];
  process: { step: string; description: string }[];
}

// Industry Verticals
export interface Vertical {
  id: string;
  slug: string;
  name: string;
  icon: string;
  shortDescription: string;
  heroHeadlineWhite: string;
  heroHeadlineGold: string;
  heroSubheadline: string;
  painPoints: PainPoint[];
  solutions: VerticalSolution[];
  caseStudy?: CaseStudy;
  /** Overrides the auto-singularized "a day at a {name}" ops-console footer
   *  phrase (strip-trailing-s breaks on irregular plurals and mass nouns —
   *  "Insurance Agencies" -> "agencie", "Manufacturing" -> "a manufacturing").
   *  Include the article: "a manufacturer", "an insurance agency". */
  opsLabel?: string;
  ctaText: string;
  ctaLink: string;
}

export interface PainPoint {
  icon: string;
  title: string;
  description: string;
}

export interface VerticalSolution {
  title: string;
  description: string;
  features: string[];
}

export interface CaseStudy {
  title: string;
  description: string;
  metrics: { label: string; value: string }[];
}

// Testimonials
export interface Testimonial {
  id: string;
  quote: string;
  name: string;
  title: string;
  businessType: string;
  rating: number;
  avatarUrl?: string;
}

// Stats
export interface Stat {
  value: string;
  numericValue: number;
  suffix: string;
  label: string;
  detail?: string;
}

// FAQ
export interface FAQ {
  question: string;
  answer: string;
  category?: string;
}

// Home page section data types
export interface ServiceOverviewItem {
  icon: string;
  name: string;
  description: string;
  href: string;
}

export interface HowItWorksStep {
  number: string;
  icon: string;
  title: string;
  description: string;
}

export interface Differentiator {
  icon: string;
  title: string;
  description: string;
}

export interface AudienceItem {
  icon: string;
  name: string;
  examples: string;
}

export interface IntegrationTool {
  name: string;
  icon: string;
  logo?: string;
}

export interface IndustryItem {
  name: string;
  icon: string;
  description: string;
  href: string;
}

// Blog
export interface BlogPostMeta {
  slug: string;
  title: string;
  excerpt: string;
  date: string;
  category: string;
  readTime: string;
}

// ========================================
// SOLUTION GENERATOR TYPES
// ========================================

export type Industry =
  | "home_services"
  | "law_firm"
  | "professional_services"
  | "real_estate"
  | "other";

export type BusinessAge =
  | "less_than_1"
  | "1_to_3"
  | "3_to_10"
  | "10_plus";

export type TeamSize =
  | "just_me"
  | "2_to_5"
  | "6_to_15"
  | "16_to_50"
  | "50_plus";

export type RevenueRange =
  | "under_100k"
  | "100k_500k"
  | "500k_1m"
  | "1m_5m"
  | "5m_plus";

export type WebsiteStatus =
  | "works_well"
  | "outdated"
  | "no_leads"
  | "no_website";

export type Timeline =
  | "asap"
  | "within_30"
  | "within_90"
  | "exploring";

export type BudgetRange =
  | "under_2500"
  | "2500_5000"
  | "5000_10000"
  | "10000_25000"
  | "25000_plus";

export type ContactMethod = "email" | "phone" | "text";

export interface IntakeFormData {
  // Step 1
  industry: Industry;
  industryOther?: string;
  // Step 2
  businessName: string;
  businessAge: BusinessAge;
  teamSize: TeamSize;
  revenueRange: RevenueRange;
  // Step 3
  websiteStatus: WebsiteStatus;
  currentTools: string[];
  industrySpecificAnswers: Record<string, string | string[]>;
  // Step 4
  painPoints: string[];
  painPointsOther?: string;
  // Step 5
  topGoals: string[];
  // Step 6
  timeline: Timeline;
  budgetRange: BudgetRange;
  // Step 7
  contactName: string;
  contactEmail: string;
  contactPhone?: string;
  contactMethod: ContactMethod;
  consentGiven: boolean;
}

// Intake question configuration
export interface IntakeOption {
  value: string;
  label: string;
  description?: string;
  icon?: string;
  priceHint?: string;
}

export interface IntakeQuestion {
  id: string;
  question: string;
  type: "single" | "multi" | "text" | "button-group";
  options: IntakeOption[];
  required?: boolean;
  industries?: Industry[]; // If set, only show for these industries
}

// ========================================
// AI GENERATED PLAN TYPES
// ========================================

export interface SolutionRecommendation {
  name: string;
  description: string;
  whyItMatters: string;
  features: string[];
  estimatedImpact: string;
  timeline: string;
  pricingOneTime?: number;
  pricingMonthly?: number;
  pricingDisplay: string;
  priority: number;
}

export interface ImplementationPhase {
  phase: number;
  name: string;
  description: string;
  duration: string;
  solutions: string[];
}

export interface ROIProjection {
  ninetyDay: {
    estimatedLeadIncrease: string;
    estimatedTimeSaved: string;
    estimatedRevenueImpact: string;
  };
  twelveMonth: {
    estimatedLeadIncrease: string;
    estimatedTimeSaved: string;
    estimatedRevenueImpact: string;
  };
  disclaimer: string;
}

export interface InvestmentSummary {
  oneTimeCosts: { item: string; amount: number }[];
  monthlyCosts: { item: string; amount: number }[];
  totalOneTime: number;
  totalMonthly: number;
  budgetNotes?: string;
}

export interface DigitalGrowthPlan {
  executiveSummary: string;
  recommendations: SolutionRecommendation[];
  implementationRoadmap: ImplementationPhase[];
  roiProjection: ROIProjection;
  investmentSummary: InvestmentSummary;
  nextSteps: string[];
}

// Supabase row type
export interface SolutionRequest {
  id: string;
  share_token: string;
  status: "pending" | "generating" | "completed" | "failed";
  industry: Industry;
  industry_other?: string;
  business_name?: string;
  contact_name: string;
  contact_email: string;
  contact_phone?: string;
  intake_data: IntakeFormData;
  ai_plan?: DigitalGrowthPlan;
  ai_model_used?: string;
  estimated_value?: number;
  view_count: number;
  lead_status: LeadStatus;
  notes?: string;
  contacted_at?: string;
  created_at: string;
  updated_at: string;
}

// Solution Generator component state
export type GeneratorStep =
  | "industry"
  | "business"
  | "digital_presence"
  | "pain_points"
  | "goals"
  | "timeline_budget"
  | "contact"
  | "generating"
  | "results";

export interface GeneratorState {
  currentStep: GeneratorStep;
  formData: Partial<IntakeFormData>;
  plan: DigitalGrowthPlan | null;
  shareToken: string | null;
  isSubmitting: boolean;
  error: string | null;
}

export type GeneratorAction =
  | { type: "SET_STEP"; step: GeneratorStep }
  | { type: "UPDATE_FORM"; data: Partial<IntakeFormData> }
  | { type: "SET_SUBMITTING"; value: boolean }
  | { type: "SET_PLAN"; plan: DigitalGrowthPlan; shareToken: string }
  | { type: "SET_ERROR"; error: string }
  | { type: "RESET" };

// ========================================
// PROMPT 2B - TRUST & CONVERSION TYPES
// ========================================

// Case Studies
export interface CaseStudyFull {
  id: string;
  slug: string;
  businessName: string;
  industry: Industry;
  location: string;
  heroImage?: string;
  logoUrl?: string;
  challenge: string;
  solution: string;
  results: string;
  testimonialQuote?: string;
  testimonialAuthor?: string;
  testimonialTitle?: string;
  metrics: CaseStudyMetric[];
  services: string[];
  timeline: string;
  featured: boolean;
  publishedAt: string;
}

export interface CaseStudyMetric {
  label: string;
  before: string;
  after: string;
  improvement: string;
}

// Website Grader
export interface WebsiteGradeResult {
  url: string;
  overallScore: number;
  categories: {
    performance: GradeCategory;
    seo: GradeCategory;
    mobile: GradeCategory;
    security: GradeCategory;
    accessibility: GradeCategory;
  };
  aiRecommendations: string[];
  generatedAt: string;
}

export interface GradeCategory {
  score: number;
  label: string;
  issues: string[];
}

// ROI Calculator
export interface ROICalculatorInputs {
  industry: Industry;
  monthlyLeads: number;
  averageDealValue: number;
  closeRate: number;
  monthlyAdSpend: number;
  hoursOnManualTasks: number;
}

export interface ROICalculatorResult {
  currentMonthlyRevenue: number;
  projectedMonthlyRevenue: number;
  additionalMonthlyRevenue: number;
  annualRevenueImpact: number;
  timeSavedPerWeek: number;
  costSavedPerMonth: number;
  roiPercentage: number;
  paybackPeriodMonths: number;
}

// Lead Magnets / Resources
export interface LeadMagnet {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  icon: string;
  coverImage?: string;
  fileUrl: string;
  category: "checklist" | "guide" | "comparison";
  downloadCount: number;
}

// Email Sequences
export type EmailSequenceType =
  | "plan_nurture"
  | "resource_welcome"
  | "grader_followup"
  | "booking_nurture"
  | "roofing_nurture"
  | "manual_audit_followup";

export interface EmailSequenceStep {
  stepNumber: number;
  subject: string;
  delayDays: number;
  bodyTemplate: string;
}

// Service Packages
export interface ServicePackage {
  id: string;
  name: string;
  slug: string;
  tagline: string;
  description: string;
  priceOneTime: number;
  priceMonthly: number;
  features: PackageFeature[];
  highlighted: boolean;
  ctaText: string;
  ctaLink: string;
  idealFor: string;
}

export interface PackageFeature {
  name: string;
  included: boolean;
  detail?: string;
}

// Partner / Referral Program
export interface PartnerApplication {
  id: string;
  name: string;
  email: string;
  company: string;
  website?: string;
  partnerType: "referral" | "agency" | "technology";
  message: string;
  status: "pending" | "approved" | "declined";
  createdAt: string;
}

export interface PartnerTier {
  name: string;
  commission: string;
  benefits: string[];
  requirements: string[];
}

// Changelog
export interface ChangelogEntry {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: "feature" | "improvement" | "fix" | "announcement";
  publishedAt: string;
}

// Cookie Consent
export interface CookiePreferences {
  necessary: boolean;
  analytics: boolean;
  marketing: boolean;
}

// ========================================
// PROMPT 2 - LEARNING HUB & CONTENT TYPES
// ========================================

export type ArticleCategory =
  | "lead-generation"
  | "automation"
  | "ai-tools"
  | "industry"
  | "foundational"
  | "local-seo";

export type ArticlePillar =
  | "Lead Gen"
  | "Automation"
  | "AI Tools"
  | "Industry"
  | "Foundational"
  | "Local SEO";

export interface ArticleFrontmatter {
  title: string;
  slug: string;
  excerpt: string;
  date: string;
  updatedDate?: string;
  category: ArticleCategory;
  pillar: ArticlePillar;
  tags: string[];
  author: string;
  authorRole?: string;
  featured?: boolean;
  seoTitle?: string;
  seoDescription?: string;
  ogImage?: string;
  targetKeywords: string[];
  funnelStage: "awareness" | "consideration" | "decision";
}

export interface Article {
  frontmatter: ArticleFrontmatter;
  slug: string;
  content: string;
  readingTime: string;
  wordCount: number;
}

// ========================================
// CHAT TYPES
// ========================================

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export interface ChatLead {
  name: string;
  email: string;
  conversation: ChatMessage[];
}

// ========================================
// CONTENT CALENDAR TYPES
// ========================================

export type ContentStatus = "idea" | "outline" | "draft" | "review" | "published";

export interface ContentCalendarItem {
  id: string;
  title: string;
  slug: string;
  status: ContentStatus;
  category: ArticleCategory;
  target_keywords: string[];
  pillar: ArticlePillar;
  funnel_stage: "awareness" | "consideration" | "decision";
  target_publish_date?: string;
  actual_publish_date?: string;
  author: string;
  notes?: string;
  seo_title?: string;
  seo_description?: string;
  word_count_target?: number;
  created_at: string;
  updated_at: string;
}

// ========================================
// LEAD STATUS TYPES
// ========================================

export type LeadStatus = "new" | "contacted" | "qualified" | "proposal" | "won" | "lost";

// ========================================
// ADMIN SETTINGS TYPES
// ========================================

export interface AdminSetting {
  key: string;
  value: string;
  is_secret: boolean;
  description?: string;
  updated_at: string;
}

// ========================================
// PLAN BUILDER CONVERSATION TYPES
// ========================================

export type ConversationInputType =
  | "option-cards"
  | "chip-select"
  | "bubble-buttons"
  | "text-input"
  | "contact-panel";

export interface QuestionDef {
  id: string;
  field: keyof IntakeFormData | string;
  message: string;
  inputType: ConversationInputType;
  options?: IntakeOption[];
  skipIf?: (formData: Partial<IntakeFormData>) => boolean;
  maxSelections?: number;
  placeholder?: string;
  required?: boolean;
  optional?: boolean;
}

export interface ConversationMessage {
  id: string;
  role: "assistant" | "user";
  content: string;
  questionId?: string;
  inputType?: ConversationInputType;
  options?: IntakeOption[];
  maxSelections?: number;
  placeholder?: string;
  isOptional?: boolean;
}

export type ConversationPhase = "chat" | "generating" | "results";
