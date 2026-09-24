import Link from "next/link";
import fs from "fs";

//read in all fodlers from root/app/Dashboards
const root = process.cwd();
const dasboardPath = `${root}/app/Dashboards`;
const testSitePaths = `${root}/app/DEV/testPages`;

let dashboardFolders: string[] = [];
let testSites: string[] = [];

const isDev = process.env.NODE_ENV === "development";

try {
  dashboardFolders = fs.readdirSync(dasboardPath);
} catch {
  console.error("Failed to read dashboard folders");
}

if (isDev) {
  try {
    testSites = fs.readdirSync(testSitePaths);
  } catch {
    console.error("Failed to read test site folders");
  }
}

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <div className="space-y-4 text-center">
        <h1 className="text-2xl font-semibold">Tableu Replacement MVP</h1>

        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-xl font-semibold">Dashboards</h2>
            {dashboardFolders.map((folder) => (
              <Link
                href={`/Dashboards/${folder}`}
                key={folder}
                className="inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700">
                {folder}
              </Link>
            ))}
          </div>

          <div>
            <h2 className="text-xl font-semibold">Test Sites</h2>
            {testSites.map((folder) => (
              <Link
                href={`/DEV/testPages/${folder}`}
                key={folder}
                className="inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700">
                {folder}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
