import { Breadcrumb } from "../components/shell/Breadcrumb";
import { AppearanceSection } from "../components/settings/AppearanceSection";
import { DefaultViewSection } from "../components/settings/DefaultViewSection";
import { IdentitySection } from "../components/settings/IdentitySection";
import { PageSizeSection } from "../components/settings/PageSizeSection";
import { ProjectsSection } from "../components/settings/ProjectsSection";
import { ReposSection } from "../components/settings/ReposSection";

export function Settings() {
  return (
    <div className="space-y-8 px-8 py-6">
      <div>
        <Breadcrumb items={[{ label: "Home", to: "/" }, { label: "Settings" }]} />
        <h1 className="mt-3 text-display font-display tracking-display text-ink-1">Settings</h1>
      </div>

      <ReposSection />
      <ProjectsSection />
      <IdentitySection />
      <DefaultViewSection />
      <PageSizeSection />
      <AppearanceSection />
    </div>
  );
}
