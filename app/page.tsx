import Link from "next/link";
import fs from "fs";

//read in all fodlers from root/app/Dashboards
const root = process.cwd();
const dasboardPath = `${root}/app/Dashboards`;

const dashboardFolders = fs.readdirSync(dasboardPath);

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <div className="space-y-4 text-center">
        <h1 className="text-2xl font-semibold">Tableu Replacement MVP</h1>

        {dashboardFolders.map((folder) => (
          <Link
            href={`/Dashboards/${folder}`}
            key={folder}
            className="inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700">
            {folder}
          </Link>
        ))}

        <Link
          href="/testPage"
          className="inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700">
          Go to test page
        </Link>
      </div>
    </main>
  );
}
