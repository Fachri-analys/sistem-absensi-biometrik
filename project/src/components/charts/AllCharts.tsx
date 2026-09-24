'use client';

import React from 'react';

export const MonthlyBarChart: React.FC = () => {
  const data = [
    { label: 'Jul', value: 92, active: false },
    { label: 'Ags', value: 94, active: false },
    { label: 'Sep', value: 96, active: true },
    { label: 'Okt', value: 85, active: false },
    { label: 'Nov', value: 90, active: false },
  ];

  return (
    <div className="bg-[#122438] text-white p-5 rounded-2xl shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h4 className="text-xs font-semibold text-slate-300">Tren Bulanan</h4>
          <p className="text-[11px] text-slate-400">Kehadiran Smt Ganjil</p>
        </div>
        <span className="text-2xl font-black text-white">96%</span>
      </div>

      {/* SVG Bar Chart */}
      <div className="flex items-end justify-between gap-3 h-28 pt-4 px-2">
        {data.map((item, idx) => (
          <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
            <div className="w-full max-w-[28px] bg-slate-700/60 rounded-t-md h-full flex items-end overflow-hidden">
              <div
                className={`w-full rounded-t-md transition-all duration-500 ${
                  item.active
                    ? 'bg-gradient-to-t from-blue-600 to-sky-400 shadow-[0_0_12px_rgba(56,189,248,0.5)]'
                    : 'bg-slate-600/80 group-hover:bg-slate-500'
                }`}
                style={{ height: `${item.value}%` }}
              />
            </div>
            <span
              className={`text-[10px] font-medium ${
                item.active ? 'text-sky-300 font-bold' : 'text-slate-400'
              }`}
            >
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export const WeeklyBarChart: React.FC = () => {
  const data = [
    { label: 'Minggu 1', value: 95 },
    { label: 'Minggu 2', value: 88 },
    { label: 'Minggu 3', value: 92 },
    { label: 'Minggu 4', value: 98 },
    { label: 'Minggu 5', value: 90 },
  ];

  return (
    <div className="w-full pt-4">
      <div className="flex items-end justify-between gap-6 h-44 px-4 pb-2 border-b border-slate-100">
        {data.map((item, idx) => (
          <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
            <div className="text-[11px] font-bold text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity">
              {item.value}%
            </div>
            <div className="w-full max-w-[36px] bg-slate-100 rounded-t-md h-full flex items-end">
              <div
                className="w-full bg-[#1e293b] group-hover:bg-blue-600 rounded-t-md transition-all duration-500"
                style={{ height: `${item.value}%` }}
              />
            </div>
            <span className="text-xs font-semibold text-slate-500 mt-1">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export const WeeklyLineChart: React.FC = () => {
  // Line chart across Senin to Minggu matching Page 14
  const points = [
    { day: 'Senin', value: 65 },
    { day: 'Selasa', value: 72 },
    { day: 'Rabu', value: 85 },
    { day: 'Kamis', value: 80 },
    { day: 'Jumat', value: 94 },
    { day: 'Sabtu', value: 90 },
    { day: 'Minggu', value: 96 },
  ];

  const width = 580;
  const height = 180;
  const paddingX = 40;
  const paddingY = 30;

  const stepX = (width - paddingX * 2) / (points.length - 1);
  const minVal = 50;
  const maxVal = 100;

  const coords = points.map((p, i) => {
    const x = paddingX + i * stepX;
    const y = height - paddingY - ((p.value - minVal) / (maxVal - minVal)) * (height - paddingY * 2);
    return { ...p, x, y };
  });

  const pathD = coords.reduce((acc, curr, idx) => {
    return idx === 0 ? `M ${curr.x} ${curr.y}` : `${acc} L ${curr.x} ${curr.y}`;
  }, '');

  return (
    <div className="w-full overflow-hidden">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-44">
        {/* Subtle grid lines */}
        <line x1={paddingX} y1={paddingY} x2={width - paddingX} y2={paddingY} stroke="#f1f5f9" strokeWidth="1" strokeDasharray="4 4" />
        <line x1={paddingX} y1={height / 2} x2={width - paddingX} y2={height / 2} stroke="#f1f5f9" strokeWidth="1" strokeDasharray="4 4" />
        <line x1={paddingX} y1={height - paddingY} x2={width - paddingX} y2={height - paddingY} stroke="#e2e8f0" strokeWidth="1" />

        {/* Gradient fill */}
        <defs>
          <linearGradient id="blueLineGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2563eb" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#2563eb" stopOpacity="0.0" />
          </linearGradient>
        </defs>
        {coords.length > 0 && (
          <path
            d={`${pathD} L ${coords[coords.length - 1]?.x ?? 0} ${height - paddingY} L ${coords[0]?.x ?? 0} ${height - paddingY} Z`}
            fill="url(#blueLineGrad)"
          />
        )}

        {/* The line */}
        <path d={pathD} fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

        {/* Dots */}
        {coords.map((c, i) => (
          <g key={i} className="cursor-pointer group">
            <circle cx={c.x} cy={c.y} r="4" fill="#ffffff" stroke="#2563eb" strokeWidth="2.5" />
            <text x={c.x} y={height - 10} textAnchor="middle" className="text-[11px] fill-slate-400 font-medium">
              {c.day}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
};

export const ClassComparisonBarChart: React.FC = () => {
  const classes = [
    { name: 'X RPL 1', value: 92 },
    { name: 'X RPL 2', value: 90 },
    { name: 'XI RPL 1', value: 98 },
    { name: 'XI RPL 2', value: 96 },
    { name: 'XII RPL 1', value: 97 },
    { name: 'XII RPL 2', value: 95 },
    { name: 'X TKJ 1', value: 88 },
    { name: 'XI TKJ 1', value: 94 },
  ];

  return (
    <div className="w-full pt-4">
      <div className="flex items-end justify-between gap-4 h-52 px-4 pb-2 border-b border-slate-100">
        {classes.map((item, idx) => (
          <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
            <div className="w-full max-w-[28px] bg-slate-100 rounded-t-sm h-full flex items-end">
              <div
                className="w-full bg-[#273240] group-hover:bg-blue-600 rounded-t-sm transition-all duration-500"
                style={{ height: `${item.value}%` }}
              />
            </div>
            <span className="text-[10px] font-semibold text-slate-500 mt-1 whitespace-nowrap">
              {item.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export const AttendanceDonutChart: React.FC = () => {
  // Values: 26 Hadir (81.25%), 4 Terlambat/Izin (12.5%), 2 Alpha (6.25%) Total = 32
  return (
    <div className="flex flex-col items-center">
      <div className="relative w-40 h-40 flex items-center justify-center my-3">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
          {/* Background circle */}
          <circle cx="50" cy="50" r="38" stroke="#f1f5f9" strokeWidth="11" fill="transparent" />

          {/* Hadir segment (hijau / green) */}
          <circle
            cx="50"
            cy="50"
            r="38"
            stroke="#16a34a"
            strokeWidth="11"
            fill="transparent"
            strokeDasharray="194 239"
            strokeDashoffset="0"
          />

          {/* Terlambat/Izin segment (kuning / yellow) */}
          <circle
            cx="50"
            cy="50"
            r="38"
            stroke="#eab308"
            strokeWidth="11"
            fill="transparent"
            strokeDasharray="30 239"
            strokeDashoffset="-196"
          />

          {/* Alpha segment (merah / red) */}
          <circle
            cx="50"
            cy="50"
            r="38"
            stroke="#dc2626"
            strokeWidth="11"
            fill="transparent"
            strokeDasharray="15 239"
            strokeDashoffset="-228"
          />
        </svg>

        <div className="absolute flex flex-col items-center justify-center text-center">
          <span className="text-xl font-extrabold text-slate-800">81%</span>
          <span className="text-[10px] text-slate-400 font-medium">Kehadiran</span>
        </div>
      </div>

      {/* Legend list */}
      <div className="w-full space-y-2 mt-2 text-xs">
        <div className="flex items-center justify-between text-slate-600">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-green-600" />
            <span>Hadir (Tepat Waktu)</span>
          </div>
          <span className="font-bold text-slate-800">26 Siswa</span>
        </div>
        <div className="flex items-center justify-between text-slate-600">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
            <span>Terlambat / Izin</span>
          </div>
          <span className="font-bold text-slate-800">4 Siswa</span>
        </div>
        <div className="flex items-center justify-between text-slate-600">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-600" />
            <span>Alpha (Alpa)</span>
          </div>
          <span className="font-bold text-slate-800">2 Siswa</span>
        </div>
      </div>
    </div>
  );
};
