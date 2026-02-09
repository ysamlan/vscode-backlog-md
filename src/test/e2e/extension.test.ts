import { expect } from 'chai';
import { ActivityBar, SideBarView, VSBrowser, Workbench } from 'vscode-extension-tester';

describe('Backlog.md Extension', function () {
  // Extension tests can be slow
  this.timeout(30000);

  let workbench: Workbench;

  before(async function () {
    this.timeout(60000);
    workbench = new Workbench();
    // Wait for VS Code to fully load
    await VSBrowser.instance.waitForWorkbench();
  });

  it('should load VS Code successfully', async function () {
    const title = await workbench.getTitleBar().getTitle();
    expect(title).to.include('Visual Studio Code');
  });

  it('should have the Backlog activity bar item', async function () {
    const activityBar = new ActivityBar();
    const controls = await activityBar.getViewControls();
    const titles = await Promise.all(controls.map((c) => c.getTitle()));

    // The Backlog view container should be present
    const hasBacklog = titles.some((t) => t.includes('Backlog'));
    expect(hasBacklog).to.be.true;
  });

  it('should open the Backlog sidebar', async function () {
    const activityBar = new ActivityBar();
    const controls = await activityBar.getViewControls();

    // Find and click the Backlog view control
    for (const control of controls) {
      const title = await control.getTitle();
      if (title.includes('Backlog')) {
        await control.openView();
        break;
      }
    }

    // Give the view time to open
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Verify sidebar is open with Backlog content
    const sidebar = new SideBarView();
    const sidebarContent = await sidebar.getContent();
    expect(sidebarContent).to.not.be.undefined;
  });

  it('should have a Details section (task preview panel) in the Backlog sidebar', async function () {
    const activityBar = new ActivityBar();
    const controls = await activityBar.getViewControls();

    // Open the Backlog view
    for (const control of controls) {
      const title = await control.getTitle();
      if (title.includes('Backlog')) {
        await control.openView();
        break;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));

    const sidebar = new SideBarView();
    const sidebarContent = await sidebar.getContent();
    const sections = await sidebarContent.getSections();
    const sectionTitles = await Promise.all(sections.map((s) => s.getTitle()));

    // The task preview panel view should be registered as "Details"
    const hasDetails = sectionTitles.some((t) => t.includes('Details'));
    expect(hasDetails).to.be.true;
  });
});
