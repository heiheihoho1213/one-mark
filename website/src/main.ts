import './style.css';

/** CI 注入 VITE_GITHUB_REPO 后更新页面上的 GitHub 链接 */
function wireGithubLinks(): void {
  const repo = import.meta.env.VITE_GITHUB_REPO as string | undefined;
  if (!repo) return;

  document.querySelectorAll<HTMLAnchorElement>('[data-github-repo]').forEach((el) => {
    el.href = `https://github.com/${repo}`;
  });
  document.querySelectorAll<HTMLAnchorElement>('[data-github-releases]').forEach((el) => {
    el.href = `https://github.com/${repo}/releases`;
  });
}

/** 移动端导航折叠 */
function wireMobileNav(): void {
  const toggle = document.getElementById('nav-toggle');
  const menu = document.getElementById('nav-menu');
  if (!toggle || !menu) return;

  toggle.addEventListener('click', () => {
    menu.classList.toggle('hidden');
    menu.classList.toggle('flex');
    menu.classList.toggle('absolute');
    menu.classList.toggle('right-5');
    menu.classList.toggle('top-14');
    menu.classList.toggle('flex-col');
    menu.classList.toggle('rounded-xl');
    menu.classList.toggle('border');
    menu.classList.toggle('border-brand-border');
    menu.classList.toggle('bg-white');
    menu.classList.toggle('p-4');
    menu.classList.toggle('shadow-lg');
  });
}

document.getElementById('year')!.textContent = String(new Date().getFullYear());
wireGithubLinks();
wireMobileNav();
