"use client";
import LineChartModule from "@/modules/LineChartModule";
import { useEffect } from "react";

export default function Home() {
  const test = async () => {
    const res = await fetch("/api/testid12345", {
      method: "POST",
      body: JSON.stringify({ test: "test" }),
    });
    const body = await res.json();
    console.log(body);
  };

  useEffect(() => {
    test();
  }, []);
  return (
    <div className="flex flex-col flex-1 items-center justify-center">
      <main className="flex flex-1 w-full max-w-3xl flex-col items-center justify-between py-32 px-16  sm:items-start">
        <LineChartModule />
      </main>
    </div>
  );
}
