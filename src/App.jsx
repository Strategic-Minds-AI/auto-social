import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import AppShell from '@/components/layout/AppShell';
import Businesses from '@/pages/Businesses';
import BusinessForm from '@/pages/BusinessForm';
import Campaigns from '@/pages/Campaigns';
import CampaignWizard from '@/pages/CampaignWizard';
import CampaignDetail from '@/pages/CampaignDetail';
import Content from '@/pages/Content';
import AutoSocial from '@/pages/AutoSocial';
import Studio from '@/pages/Studio';
import Calendar from '@/pages/Calendar';
import ApprovalQueue from '@/pages/ApprovalQueue';
import SocialAccounts from '@/pages/SocialAccounts';
import Dashboard from '@/pages/Dashboard';
import Analytics from '@/pages/Analytics';
import Assistant from '@/pages/Assistant';
import TextAlerts from '@/pages/TextAlerts';
import Leads from '@/pages/Leads';
import Onboarding from '@/pages/Onboarding';
import Intelligence from '@/pages/Intelligence';
import VideoStudio from '@/pages/VideoStudio';
import MediaLibrary from '@/pages/MediaLibrary';
import DemandRadar from '@/pages/DemandRadar';
import Discovery from '@/pages/Discovery';
import Pipeline from '@/pages/Pipeline';
import ProfileMakeover from '@/pages/ProfileMakeover';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/onboarding" element={<Onboarding />} />
      <Route element={<AppShell />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/leads" element={<Leads />} />
        <Route path="/intelligence" element={<Intelligence />} />
        <Route path="/demand-radar" element={<DemandRadar />} />
        <Route path="/discovery" element={<Discovery />} />
        <Route path="/pipeline" element={<Pipeline />} />
        <Route path="/assistant" element={<Assistant />} />
        <Route path="/businesses" element={<Businesses />} />
        <Route path="/businesses/new" element={<BusinessForm />} />
        <Route path="/businesses/edit/:id" element={<BusinessForm />} />
        <Route path="/campaigns" element={<Campaigns />} />
        <Route path="/campaigns/new" element={<CampaignWizard />} />
        <Route path="/campaigns/:id" element={<CampaignDetail />} />
        <Route path="/content" element={<Content />} />
        <Route path="/studio" element={<Studio />} />
        <Route path="/auto-social" element={<AutoSocial />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/approval-queue" element={<ApprovalQueue />} />
        <Route path="/social-accounts" element={<SocialAccounts />} />
        <Route path="/profile-makeover" element={<ProfileMakeover />} />
        <Route path="/text-alerts" element={<TextAlerts />} />
        <Route path="/video-studio" element={<VideoStudio />} />
        <Route path="/creative-assets" element={<MediaLibrary />} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App