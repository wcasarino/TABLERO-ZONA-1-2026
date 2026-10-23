import React, { useMemo, useState, useRef } from 'react';
import { Filters } from '../types';
import { getMesName, sortMeses, cn } from '../lib/utils';
import DownloadPdfButton from './DownloadPdfButton';
import DownloadExcelButton from './DownloadExcelButton';
import { Search, Percent, Hash, ChevronDown, ChevronUp } from 'lucide-react';

interface Props {
  data: any[];
  isPrinting?: boolean;
  setFilters?: React.Dispatch<React.SetStateAction<Filters>>;
}

interface GuardiaMonthMetrics {
  count: number;
  dias: number;
  atedia: number;
  sinAsi: number;
  resu: number;
  emer: number;
  urg: number;
  urgM: number;
  sinUrg: number;
  obito: number;
  pctSinAsi: string;
  pctResu: string;
  pctEmer: string;
  pctUrg: string;
  pctUrgM: string;
  pctSinUrg: string;
  pctObito: string;
}

interface GuardiaCapsRow {
  name: string;
  totalCount: number;
  totalDias: number;
  totalAtedia: number;
  totalSinAsi: number;
  totalResu: number;
  totalEmer: number;
  totalUrg: number;
  totalUrgM: number;
  totalSinUrg: number;
  totalObito: number;
  totalPctSinAsi: string;
  totalPctResu: string;
  totalPctEmer: string;
  totalPctUrg: string;
  totalPctUrgM: string;
  totalPctSinUrg: string;
  totalPctObito: string;
  byMonth: Record<string, GuardiaMonthMetrics>;
}

function classifyTriage(raw?: string): 'sinAsi' | 'resu' | 'emer' | 'urg' | 'urgM' | 'sinUrg' | 'obito' {
  const str = String(raw || '').trim();
  const lower = str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (!str || lower.includes('sin asignar') || lower === 'sin nivel' || lower === 'desconocido' || lower === '-') {
    return 'sinAsi';
  } else if (lower.includes('resucita')) {
    return 'resu';
  } else if (lower.includes('emergencia')) {
    return 'emer';
  } else if (lower.includes('urgencia menor') || lower.includes('menor')) {
    return 'urgM';
  } else if (lower.includes('sin urgencia') || lower.includes('no urgente')) {
    return 'sinUrg';
  } else if (lower === 'urgencia' || lower.includes('urgencia')) {
    return 'urg';
  } else if (lower.includes('obito') || lower.includes('óbito')) {
    return 'obito';
  }
  return 'sinAsi';
}

export default function GuardiasMensualesPorCapsTable({
  data,
  isPrinting = false,
  setFilters,
}: Props) {
  const tableRef = useRef<HTMLDivElement>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'pct' | 'raw'>('pct');
  const [isCollapsed, setIsCollapsed] = useState(false);

  // 1. Extraer los meses únicos presentes en la data filtrada
  const months = useMemo(() => {
    if (!data || data.length === 0) return [];
    const set = new Set<string>();
    data.forEach(item => {
      const m = getMesName(item.fecha);
      if (m) set.add(m);
    });
    return sortMeses(Array.from(set));
  }, [data]);

  // 2. Agrupar por CAPS y por Mes para GUARDIA
  const { rows, totals } = useMemo(() => {
    if (!data || data.length === 0 || months.length === 0) {
      return { rows: [], totals: null };
    }

    const capsMap = new Map<string, {
      name: string;
      totalCount: number;
      allFechas: Set<string>;
      totalSinAsi: number;
      totalResu: number;
      totalEmer: number;
      totalUrg: number;
      totalUrgM: number;
      totalSinUrg: number;
      totalObito: number;
      byMonth: Record<string, {
        count: number;
        fechas: Set<string>;
        sinAsi: number;
        resu: number;
        emer: number;
        urg: number;
        urgM: number;
        sinUrg: number;
        obito: number;
      }>;
    }>();

    // Acumulador de totales por mes
    const monthTotalsAccum: Record<string, {
      count: number;
      fechas: Set<string>;
      sinAsi: number;
      resu: number;
      emer: number;
      urg: number;
      urgM: number;
      sinUrg: number;
      obito: number;
    }> = {};

    months.forEach(m => {
      monthTotalsAccum[m] = {
        count: 0,
        fechas: new Set<string>(),
        sinAsi: 0,
        resu: 0,
        emer: 0,
        urg: 0,
        urgM: 0,
        sinUrg: 0,
        obito: 0,
      };
    });

    let grandTotalCount = 0;
    const grandTotalFechas = new Set<string>();
    let grandTotalSinAsi = 0;
    let grandTotalResu = 0;
    let grandTotalEmer = 0;
    let grandTotalUrg = 0;
    let grandTotalUrgM = 0;
    let grandTotalSinUrg = 0;
    let grandTotalObito = 0;

    data.forEach(d => {
      const caps = String(d.caps || 'Desconocido').trim();
      const m = getMesName(d.fecha);
      if (!m || !monthTotalsAccum[m]) return;

      if (!capsMap.has(caps)) {
        const initialByMonth: Record<string, {
          count: number;
          fechas: Set<string>;
          sinAsi: number;
          resu: number;
          emer: number;
          urg: number;
          urgM: number;
          sinUrg: number;
          obito: number;
        }> = {};

        months.forEach(mo => {
          initialByMonth[mo] = {
            count: 0,
            fechas: new Set<string>(),
            sinAsi: 0,
            resu: 0,
            emer: 0,
            urg: 0,
            urgM: 0,
            sinUrg: 0,
            obito: 0,
          };
        });

        capsMap.set(caps, {
          name: caps,
          totalCount: 0,
          allFechas: new Set<string>(),
          totalSinAsi: 0,
          totalResu: 0,
          totalEmer: 0,
          totalUrg: 0,
          totalUrgM: 0,
          totalSinUrg: 0,
          totalObito: 0,
          byMonth: initialByMonth,
        });
      }

      const entry = capsMap.get(caps)!;
      const mEntry = entry.byMonth[m];

      entry.totalCount += 1;
      mEntry.count += 1;
      monthTotalsAccum[m].count += 1;
      grandTotalCount += 1;

      if (d.fecha) {
        const day = d.fecha.split('T')[0];
        entry.allFechas.add(day);
        mEntry.fechas.add(day);
        monthTotalsAccum[m].fechas.add(day);
        grandTotalFechas.add(day);
      }

      const triageKey = classifyTriage(d.nivel);
      if (triageKey === 'sinAsi') {
        entry.totalSinAsi += 1;
        grandTotalSinAsi += 1;
      } else if (triageKey === 'resu') {
        entry.totalResu += 1;
        grandTotalResu += 1;
      } else if (triageKey === 'emer') {
        entry.totalEmer += 1;
        grandTotalEmer += 1;
      } else if (triageKey === 'urg') {
        entry.totalUrg += 1;
        grandTotalUrg += 1;
      } else if (triageKey === 'urgM') {
        entry.totalUrgM += 1;
        grandTotalUrgM += 1;
      } else if (triageKey === 'sinUrg') {
        entry.totalSinUrg += 1;
        grandTotalSinUrg += 1;
      } else if (triageKey === 'obito') {
        entry.totalObito += 1;
        grandTotalObito += 1;
      }

      mEntry[triageKey] += 1;
      monthTotalsAccum[m][triageKey] += 1;
    });

    const calculatedRows: GuardiaCapsRow[] = Array.from(capsMap.values()).map(entry => {
      const totalDias = entry.allFechas.size;
      const totalAtedia = totalDias > 0 ? Math.round(entry.totalCount / totalDias) : 0;
      const tot = entry.totalCount;

      const totalPctSinAsi = tot > 0 ? Math.round((entry.totalSinAsi / tot) * 100) + '%' : '0%';
      const totalPctResu = tot > 0 ? Math.round((entry.totalResu / tot) * 100) + '%' : '0%';
      const totalPctEmer = tot > 0 ? Math.round((entry.totalEmer / tot) * 100) + '%' : '0%';
      const totalPctUrg = tot > 0 ? Math.round((entry.totalUrg / tot) * 100) + '%' : '0%';
      const totalPctUrgM = tot > 0 ? Math.round((entry.totalUrgM / tot) * 100) + '%' : '0%';
      const totalPctSinUrg = tot > 0 ? Math.round((entry.totalSinUrg / tot) * 100) + '%' : '0%';
      const totalPctObito = tot > 0 ? Math.round((entry.totalObito / tot) * 100) + '%' : '0%';

      const byMonthProcessed: Record<string, GuardiaMonthMetrics> = {};
      months.forEach(m => {
        const mData = entry.byMonth[m] || {
          count: 0,
          fechas: new Set(),
          sinAsi: 0,
          resu: 0,
          emer: 0,
          urg: 0,
          urgM: 0,
          sinUrg: 0,
          obito: 0,
        };
        const mDias = mData.fechas.size;
        const mAtedia = mDias > 0 ? Math.round(mData.count / mDias) : 0;
        const mTot = mData.count;

        byMonthProcessed[m] = {
          count: mData.count,
          dias: mDias,
          atedia: mAtedia,
          sinAsi: mData.sinAsi,
          resu: mData.resu,
          emer: mData.emer,
          urg: mData.urg,
          urgM: mData.urgM,
          sinUrg: mData.sinUrg,
          obito: mData.obito,
          pctSinAsi: mTot > 0 ? Math.round((mData.sinAsi / mTot) * 100) + '%' : '0%',
          pctResu: mTot > 0 ? Math.round((mData.resu / mTot) * 100) + '%' : '0%',
          pctEmer: mTot > 0 ? Math.round((mData.emer / mTot) * 100) + '%' : '0%',
          pctUrg: mTot > 0 ? Math.round((mData.urg / mTot) * 100) + '%' : '0%',
          pctUrgM: mTot > 0 ? Math.round((mData.urgM / mTot) * 100) + '%' : '0%',
          pctSinUrg: mTot > 0 ? Math.round((mData.sinUrg / mTot) * 100) + '%' : '0%',
          pctObito: mTot > 0 ? Math.round((mData.obito / mTot) * 100) + '%' : '0%',
        };
      });

      return {
        name: entry.name,
        totalCount: entry.totalCount,
        totalDias,
        totalAtedia,
        totalSinAsi: entry.totalSinAsi,
        totalResu: entry.totalResu,
        totalEmer: entry.totalEmer,
        totalUrg: entry.totalUrg,
        totalUrgM: entry.totalUrgM,
        totalSinUrg: entry.totalSinUrg,
        totalObito: entry.totalObito,
        totalPctSinAsi,
        totalPctResu,
        totalPctEmer,
        totalPctUrg,
        totalPctUrgM,
        totalPctSinUrg,
        totalPctObito,
        byMonth: byMonthProcessed,
      };
    });

    // Ordenar descendente por totalCount
    calculatedRows.sort((a, b) => b.totalCount - a.totalCount);

    // Totales globales
    const grandTotalDias = grandTotalFechas.size;
    const grandTotalAtedia = grandTotalDias > 0 ? Math.round(grandTotalCount / grandTotalDias) : 0;
    const gTot = grandTotalCount;

    const byMonthTotalsProcessed: Record<string, GuardiaMonthMetrics> = {};
    months.forEach(m => {
      const mData = monthTotalsAccum[m];
      const mDias = mData.fechas.size;
      const mAtedia = mDias > 0 ? Math.round(mData.count / mDias) : 0;
      const mTot = mData.count;

      byMonthTotalsProcessed[m] = {
        count: mData.count,
        dias: mDias,
        atedia: mAtedia,
        sinAsi: mData.sinAsi,
        resu: mData.resu,
        emer: mData.emer,
        urg: mData.urg,
        urgM: mData.urgM,
        sinUrg: mData.sinUrg,
        obito: mData.obito,
        pctSinAsi: mTot > 0 ? Math.round((mData.sinAsi / mTot) * 100) + '%' : '0%',
        pctResu: mTot > 0 ? Math.round((mData.resu / mTot) * 100) + '%' : '0%',
        pctEmer: mTot > 0 ? Math.round((mData.emer / mTot) * 100) + '%' : '0%',
        pctUrg: mTot > 0 ? Math.round((mData.urg / mTot) * 100) + '%' : '0%',
        pctUrgM: mTot > 0 ? Math.round((mData.urgM / mTot) * 100) + '%' : '0%',
        pctSinUrg: mTot > 0 ? Math.round((mData.sinUrg / mTot) * 100) + '%' : '0%',
        pctObito: mTot > 0 ? Math.round((mData.obito / mTot) * 100) + '%' : '0%',
      };
    });

    const calculatedTotals = {
      totalCount: grandTotalCount,
      totalDias: grandTotalDias,
      totalAtedia: grandTotalAtedia,
      totalSinAsi: grandTotalSinAsi,
      totalResu: grandTotalResu,
      totalEmer: grandTotalEmer,
      totalUrg: grandTotalUrg,
      totalUrgM: grandTotalUrgM,
      totalSinUrg: grandTotalSinUrg,
      totalObito: grandTotalObito,
      totalPctSinAsi: gTot > 0 ? Math.round((grandTotalSinAsi / gTot) * 100) + '%' : '0%',
      totalPctResu: gTot > 0 ? Math.round((grandTotalResu / gTot) * 100) + '%' : '0%',
      totalPctEmer: gTot > 0 ? Math.round((grandTotalEmer / gTot) * 100) + '%' : '0%',
      totalPctUrg: gTot > 0 ? Math.round((grandTotalUrg / gTot) * 100) + '%' : '0%',
      totalPctUrgM: gTot > 0 ? Math.round((grandTotalUrgM / gTot) * 100) + '%' : '0%',
      totalPctSinUrg: gTot > 0 ? Math.round((grandTotalSinUrg / gTot) * 100) + '%' : '0%',
      totalPctObito: gTot > 0 ? Math.round((grandTotalObito / gTot) * 100) + '%' : '0%',
      byMonth: byMonthTotalsProcessed,
    };

    return { rows: calculatedRows, totals: calculatedTotals };
  }, [data, months]);

  // Filtrado por buscador
  const filteredRows = useMemo(() => {
    if (!searchTerm.trim()) return rows;
    const term = searchTerm.trim().toLowerCase();
    return rows.filter(r => r.name.toLowerCase().includes(term));
  }, [rows, searchTerm]);

  // Datos para exportar a Excel: ATEDIA, Cant, Sin Asi., Resu., Emer., Urg., Urg. M., Sin Urg., Obito
  const excelData = useMemo(() => {
    return filteredRows.map(r => {
      const obj: Record<string, any> = { CAPS: r.name };
      months.forEach(m => {
        const mm = r.byMonth[m];
        obj[`${m} - ATEDIA`] = mm ? mm.atedia : 0;
        obj[`${m} - Cant`] = mm ? mm.count : 0;
        if (viewMode === 'pct') {
          obj[`${m} - Sin Asi.`] = mm ? mm.pctSinAsi : '0%';
          obj[`${m} - Resu.`] = mm ? mm.pctResu : '0%';
          obj[`${m} - Emer.`] = mm ? mm.pctEmer : '0%';
          obj[`${m} - Urg.`] = mm ? mm.pctUrg : '0%';
          obj[`${m} - Urg. M.`] = mm ? mm.pctUrgM : '0%';
          obj[`${m} - Sin Urg.`] = mm ? mm.pctSinUrg : '0%';
          obj[`${m} - Obito`] = mm ? mm.pctObito : '0%';
        } else {
          obj[`${m} - Sin Asi. (cant)`] = mm ? mm.sinAsi : 0;
          obj[`${m} - Resu. (cant)`] = mm ? mm.resu : 0;
          obj[`${m} - Emer. (cant)`] = mm ? mm.emer : 0;
          obj[`${m} - Urg. (cant)`] = mm ? mm.urg : 0;
          obj[`${m} - Urg. M. (cant)`] = mm ? mm.urgM : 0;
          obj[`${m} - Sin Urg. (cant)`] = mm ? mm.sinUrg : 0;
          obj[`${m} - Obito (cant)`] = mm ? mm.obito : 0;
        }
      });
      if (months.length > 1) {
        obj['Total - ATEDIA'] = r.totalAtedia;
        obj['Total - Cant'] = r.totalCount;
        if (viewMode === 'pct') {
          obj['Total - Sin Asi.'] = r.totalPctSinAsi;
          obj['Total - Resu.'] = r.totalPctResu;
          obj['Total - Emer.'] = r.totalPctEmer;
          obj['Total - Urg.'] = r.totalPctUrg;
          obj['Total - Urg. M.'] = r.totalPctUrgM;
          obj['Total - Sin Urg.'] = r.totalPctSinUrg;
          obj['Total - Obito'] = r.totalPctObito;
        } else {
          obj['Total - Sin Asi. (cant)'] = r.totalSinAsi;
          obj['Total - Resu. (cant)'] = r.totalResu;
          obj['Total - Emer. (cant)'] = r.totalEmer;
          obj['Total - Urg. (cant)'] = r.totalUrg;
          obj['Total - Urg. M. (cant)'] = r.totalUrgM;
          obj['Total - Sin Urg. (cant)'] = r.totalSinUrg;
          obj['Total - Obito (cant)'] = r.totalObito;
        }
      }
      return obj;
    });
  }, [filteredRows, months, viewMode]);

  if (!data || data.length === 0 || months.length === 0) {
    return null;
  }

  return (
    <div
      ref={tableRef}
      className={cn(
        "w-full bg-white border border-slate-200 rounded shadow-xs mb-2 transition-all",
        isPrinting ? "h-auto overflow-visible block" : (isCollapsed ? "h-auto" : "flex flex-col h-60 overflow-hidden")
      )}
    >
      {/* Header del Card */}
      <div className="bg-slate-50 px-3 py-1.5 border-b border-slate-200 flex flex-wrap justify-between items-center gap-2 shrink-0">
        <div className="flex items-center gap-2">
          {!isPrinting && (
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="text-slate-500 hover:text-slate-800 p-0.5 rounded transition-colors cursor-pointer"
              title={isCollapsed ? "Expandir tabla" : "Minimizar tabla"}
            >
              {isCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
            </button>
          )}
          <h3 className="font-bold uppercase text-[11px] text-slate-700 tracking-tight flex items-center gap-1.5">
            GUARDIAS MENSUALES POR CAPS
          </h3>
          <span className="text-[9px] font-semibold text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full">
            {filteredRows.length} CAPS
          </span>
          <span className="text-[9px] font-medium text-slate-400 hidden sm:inline">
            ({months.join(' • ')})
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Selector de modo (% o valores numéricos) */}
          {!isCollapsed && (
            <div className="flex items-center bg-slate-200 rounded p-0.5 text-[9px] font-bold">
              <button
                onClick={() => setViewMode('pct')}
                className={cn(
                  "px-2 py-0.5 rounded transition-all flex items-center gap-0.5 cursor-pointer",
                  viewMode === 'pct' ? "bg-white text-blue-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
                )}
                title="Mostrar triages en porcentajes sobre el total"
              >
                <Percent className="w-2.5 h-2.5" /> %
              </button>
              <button
                onClick={() => setViewMode('raw')}
                className={cn(
                  "px-2 py-0.5 rounded transition-all flex items-center gap-0.5 cursor-pointer",
                  viewMode === 'raw' ? "bg-white text-blue-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
                )}
                title="Mostrar cantidades absolutas de triages"
              >
                <Hash className="w-2.5 h-2.5" /> Cant
              </button>
            </div>
          )}

          {/* Buscador */}
          {!isPrinting && !isCollapsed && (
            <div className="relative flex items-center">
              <Search className="w-3 h-3 text-slate-400 absolute left-2 pointer-events-none" />
              <input
                type="text"
                placeholder="Buscar CAPS..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="text-[10px] pl-6 pr-2 py-0.5 bg-white border border-slate-300 rounded text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 w-28 sm:w-36"
              />
            </div>
          )}

          {/* Botones de Descarga */}
          {!isPrinting && (
            <div className="flex items-center gap-1">
              <DownloadExcelButton
                data={excelData}
                filename="guardias-mensuales-por-caps"
                sheetName="Guardias Mensuales CAPS"
              />
              <DownloadPdfButton
                targetRef={tableRef}
                filename="guardias-mensuales-por-caps"
              />
            </div>
          )}
        </div>
      </div>

      {/* Contenedor de la Tabla */}
      {!isCollapsed && (
        <div className={cn(
          "bg-white relative",
          isPrinting ? "w-full overflow-visible h-auto block" : "flex-1 overflow-auto custom-scrollbar"
        )}>
          <table className="w-full text-[10px] text-left border-collapse">
            {/* Encabezado Fila 1: Grupos de Meses */}
            <thead className="sticky top-0 bg-slate-100 z-10 shadow-xs">
              <tr className="border-b border-slate-300">
                <th
                  rowSpan={2}
                  className="px-2 py-1.5 font-bold text-slate-700 border-r border-slate-300 bg-slate-200 sticky left-0 z-20 min-w-[130px] uppercase tracking-wider text-[10px]"
                >
                  CAPS
                </th>
                {months.map(m => (
                  <th
                    key={m}
                    colSpan={9}
                    className="px-2 py-1 font-bold text-slate-800 text-center uppercase tracking-tight border-r border-slate-300 bg-slate-200/95 text-[10px]"
                  >
                    {m}
                  </th>
                ))}
                {months.length > 1 && (
                  <th
                    colSpan={9}
                    className="px-2 py-1 font-bold text-blue-900 text-center uppercase tracking-tight bg-blue-100/95 border-l border-blue-200 text-[10px]"
                  >
                    TOTAL ACUMULADO
                  </th>
                )}
              </tr>

              {/* Encabezado Fila 2: Subcolumnas exactas: ATEDIA, Cant, Sin Asi., Resu., Emer., Urg., Urg. M., Sin Urg., Obito */}
              <tr className="border-b border-slate-300 bg-slate-100 text-[9px]">
                {months.map(m => (
                  <React.Fragment key={`${m}-sub`}>
                    <th className="px-1.5 py-1 font-bold text-slate-700 text-right w-11" title="Promedio de atenciones diarias del mes">
                      ATEDIA
                    </th>
                    <th className="px-1.5 py-1 font-bold text-slate-900 text-right w-12" title="Total de atenciones de guardia del mes">
                      Cant
                    </th>
                    <th className="px-1.5 py-1 font-bold text-slate-500 text-right w-11" title="Triage Sin Asignar">
                      Sin Asi.
                    </th>
                    <th className="px-1.5 py-1 font-bold text-rose-700 text-right w-11" title="Triage Resucitación">
                      Resu.
                    </th>
                    <th className="px-1.5 py-1 font-bold text-red-600 text-right w-11" title="Triage Emergencia">
                      Emer.
                    </th>
                    <th className="px-1.5 py-1 font-bold text-amber-600 text-right w-11" title="Triage Urgencia">
                      Urg.
                    </th>
                    <th className="px-1.5 py-1 font-bold text-yellow-600 text-right w-12" title="Triage Urgencia Menor">
                      Urg. M.
                    </th>
                    <th className="px-1.5 py-1 font-bold text-emerald-700 text-right w-12" title="Triage Sin Urgencia">
                      Sin Urg.
                    </th>
                    <th className="px-1.5 py-1 font-bold text-slate-600 text-right border-r border-slate-300 w-11" title="Triage Óbito">
                      Obito
                    </th>
                  </React.Fragment>
                ))}

                {months.length > 1 && (
                  <>
                    <th className="px-1.5 py-1 font-bold text-slate-800 text-right bg-blue-50/80 w-11" title="ATEDIA total">
                      ATEDIA
                    </th>
                    <th className="px-1.5 py-1 font-bold text-slate-950 text-right bg-blue-50/80 w-12" title="Total general de atenciones">
                      Cant
                    </th>
                    <th className="px-1.5 py-1 font-bold text-slate-600 text-right bg-blue-50/80 w-11" title="Total Sin Asignar">
                      Sin Asi.
                    </th>
                    <th className="px-1.5 py-1 font-bold text-rose-800 text-right bg-blue-50/80 w-11" title="Total Resucitación">
                      Resu.
                    </th>
                    <th className="px-1.5 py-1 font-bold text-red-700 text-right bg-blue-50/80 w-11" title="Total Emergencia">
                      Emer.
                    </th>
                    <th className="px-1.5 py-1 font-bold text-amber-700 text-right bg-blue-50/80 w-11" title="Total Urgencia">
                      Urg.
                    </th>
                    <th className="px-1.5 py-1 font-bold text-yellow-700 text-right bg-blue-50/80 w-12" title="Total Urgencia Menor">
                      Urg. M.
                    </th>
                    <th className="px-1.5 py-1 font-bold text-emerald-800 text-right bg-blue-50/80 w-12" title="Total Sin Urgencia">
                      Sin Urg.
                    </th>
                    <th className="px-1.5 py-1 font-bold text-slate-700 text-right bg-blue-50/80 w-11" title="Total Óbito">
                      Obito
                    </th>
                  </>
                )}
              </tr>
            </thead>

            {/* Cuerpo de la Tabla */}
            <tbody className="divide-y divide-slate-100">
              {filteredRows.map((row, i) => (
                <tr
                  key={row.name}
                  className={cn(
                    "hover:bg-blue-50/50 transition-colors",
                    i % 2 === 1 ? "bg-slate-50/40" : "bg-white"
                  )}
                >
                  {/* Nombre del CAPS */}
                  <td
                    className={cn(
                      "px-2 py-1 text-slate-800 font-medium border-r border-slate-200 sticky left-0 bg-inherit z-10",
                      isPrinting ? "whitespace-normal break-words" : "truncate max-w-[150px]",
                      setFilters && "cursor-pointer hover:text-blue-600 hover:font-bold"
                    )}
                    onDoubleClick={() => setFilters?.(prev => ({ ...prev, caps: [row.name] }))}
                    title={`${row.name} (Doble clic para filtrar)`}
                  >
                    {row.name}
                  </td>

                  {/* Columnas por Mes: ATEDIA, Cant, Sin Asi., Resu., Emer., Urg., Urg. M., Sin Urg., Obito */}
                  {months.map(m => {
                    const mm = row.byMonth[m] || {
                      count: 0,
                      dias: 0,
                      atedia: 0,
                      sinAsi: 0,
                      resu: 0,
                      emer: 0,
                      urg: 0,
                      urgM: 0,
                      sinUrg: 0,
                      obito: 0,
                      pctSinAsi: '0%',
                      pctResu: '0%',
                      pctEmer: '0%',
                      pctUrg: '0%',
                      pctUrgM: '0%',
                      pctSinUrg: '0%',
                      pctObito: '0%',
                    };
                    const hasData = mm.count > 0;
                    return (
                      <React.Fragment key={`${row.name}-${m}`}>
                        {/* ATEDIA */}
                        <td className="px-1.5 py-1 text-right font-mono font-medium text-slate-700">
                          {hasData ? mm.atedia : '-'}
                        </td>

                        {/* Cant */}
                        <td className="px-1.5 py-1 text-right font-mono font-bold text-slate-900">
                          {hasData ? mm.count.toLocaleString('es-AR') : '-'}
                        </td>

                        {/* Sin Asi. */}
                        <td
                          className={cn(
                            "px-1.5 py-1 text-right font-mono font-medium",
                            hasData && mm.sinAsi > 0 ? "text-slate-600" : "text-slate-300"
                          )}
                          title={`Sin Asignar: ${mm.sinAsi} (${mm.pctSinAsi})`}
                        >
                          {hasData ? (viewMode === 'pct' ? mm.pctSinAsi : mm.sinAsi) : '-'}
                        </td>

                        {/* Resu. */}
                        <td
                          className={cn(
                            "px-1.5 py-1 text-right font-mono font-bold",
                            hasData && mm.resu > 0 ? "text-rose-700" : "text-slate-300"
                          )}
                          title={`Resucitación: ${mm.resu} (${mm.pctResu})`}
                        >
                          {hasData ? (viewMode === 'pct' ? mm.pctResu : mm.resu) : '-'}
                        </td>

                        {/* Emer. */}
                        <td
                          className={cn(
                            "px-1.5 py-1 text-right font-mono font-bold",
                            hasData && mm.emer > 0 ? "text-red-600" : "text-slate-300"
                          )}
                          title={`Emergencia: ${mm.emer} (${mm.pctEmer})`}
                        >
                          {hasData ? (viewMode === 'pct' ? mm.pctEmer : mm.emer) : '-'}
                        </td>

                        {/* Urg. */}
                        <td
                          className={cn(
                            "px-1.5 py-1 text-right font-mono font-medium",
                            hasData && mm.urg > 0 ? "text-amber-600" : "text-slate-300"
                          )}
                          title={`Urgencia: ${mm.urg} (${mm.pctUrg})`}
                        >
                          {hasData ? (viewMode === 'pct' ? mm.pctUrg : mm.urg) : '-'}
                        </td>

                        {/* Urg. M. */}
                        <td
                          className={cn(
                            "px-1.5 py-1 text-right font-mono font-medium",
                            hasData && mm.urgM > 0 ? "text-yellow-600" : "text-slate-300"
                          )}
                          title={`Urgencia Menor: ${mm.urgM} (${mm.pctUrgM})`}
                        >
                          {hasData ? (viewMode === 'pct' ? mm.pctUrgM : mm.urgM) : '-'}
                        </td>

                        {/* Sin Urg. */}
                        <td
                          className={cn(
                            "px-1.5 py-1 text-right font-mono font-medium",
                            hasData && mm.sinUrg > 0 ? "text-emerald-700" : "text-slate-300"
                          )}
                          title={`Sin Urgencia: ${mm.sinUrg} (${mm.pctSinUrg})`}
                        >
                          {hasData ? (viewMode === 'pct' ? mm.pctSinUrg : mm.sinUrg) : '-'}
                        </td>

                        {/* Obito */}
                        <td
                          className={cn(
                            "px-1.5 py-1 text-right font-mono font-medium border-r border-slate-200",
                            hasData && mm.obito > 0 ? "text-slate-800 font-bold" : "text-slate-300"
                          )}
                          title={`Óbito: ${mm.obito} (${mm.pctObito})`}
                        >
                          {hasData ? (viewMode === 'pct' ? mm.pctObito : mm.obito) : '-'}
                        </td>
                      </React.Fragment>
                    );
                  })}

                  {/* Columnas Total Acumulado */}
                  {months.length > 1 && (
                    <>
                      <td className="px-1.5 py-1 text-right font-mono font-semibold text-slate-800 bg-blue-50/40">
                        {row.totalAtedia}
                      </td>
                      <td className="px-1.5 py-1 text-right font-mono font-bold text-slate-950 bg-blue-50/50">
                        {row.totalCount.toLocaleString('es-AR')}
                      </td>
                      <td className="px-1.5 py-1 text-right font-mono text-slate-600 bg-blue-50/30">
                        {viewMode === 'pct' ? row.totalPctSinAsi : row.totalSinAsi}
                      </td>
                      <td className="px-1.5 py-1 text-right font-mono font-bold text-rose-800 bg-blue-50/30">
                        {viewMode === 'pct' ? row.totalPctResu : row.totalResu}
                      </td>
                      <td className="px-1.5 py-1 text-right font-mono font-bold text-red-700 bg-blue-50/30">
                        {viewMode === 'pct' ? row.totalPctEmer : row.totalEmer}
                      </td>
                      <td className="px-1.5 py-1 text-right font-mono text-amber-700 bg-blue-50/30">
                        {viewMode === 'pct' ? row.totalPctUrg : row.totalUrg}
                      </td>
                      <td className="px-1.5 py-1 text-right font-mono text-yellow-700 bg-blue-50/30">
                        {viewMode === 'pct' ? row.totalPctUrgM : row.totalUrgM}
                      </td>
                      <td className="px-1.5 py-1 text-right font-mono text-emerald-800 bg-blue-50/30">
                        {viewMode === 'pct' ? row.totalPctSinUrg : row.totalSinUrg}
                      </td>
                      <td className="px-1.5 py-1 text-right font-mono text-slate-700 bg-blue-50/30">
                        {viewMode === 'pct' ? row.totalPctObito : row.totalObito}
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>

            {/* Fila de Totales en el Pie de la Tabla */}
            {totals && (
              <tfoot className="sticky bottom-0 bg-slate-200 border-t-2 border-slate-300 font-bold z-10 shadow-xs">
                <tr>
                  <td className="px-2 py-1.5 text-slate-900 uppercase font-bold border-r border-slate-300 sticky left-0 bg-slate-200 z-20">
                    TOTAL
                  </td>
                  {months.map(m => {
                    const tm = totals.byMonth[m];
                    return (
                      <React.Fragment key={`tot-${m}`}>
                        {/* ATEDIA */}
                        <td className="px-1.5 py-1 text-right font-mono text-slate-800 font-bold" title="ATEDIA promedio global del mes">
                          {tm.atedia}
                        </td>
                        {/* Cant */}
                        <td className="px-1.5 py-1 text-right font-mono text-slate-950 font-extrabold" title="Cantidad total de atenciones del mes">
                          {tm.count.toLocaleString('es-AR')}
                        </td>
                        {/* Sin Asi. */}
                        <td className="px-1.5 py-1 text-right font-mono text-slate-700">
                          {viewMode === 'pct' ? tm.pctSinAsi : tm.sinAsi.toLocaleString('es-AR')}
                        </td>
                        {/* Resu. */}
                        <td className="px-1.5 py-1 text-right font-mono text-rose-800">
                          {viewMode === 'pct' ? tm.pctResu : tm.resu.toLocaleString('es-AR')}
                        </td>
                        {/* Emer. */}
                        <td className="px-1.5 py-1 text-right font-mono text-red-700">
                          {viewMode === 'pct' ? tm.pctEmer : tm.emer.toLocaleString('es-AR')}
                        </td>
                        {/* Urg. */}
                        <td className="px-1.5 py-1 text-right font-mono text-amber-700">
                          {viewMode === 'pct' ? tm.pctUrg : tm.urg.toLocaleString('es-AR')}
                        </td>
                        {/* Urg. M. */}
                        <td className="px-1.5 py-1 text-right font-mono text-yellow-700">
                          {viewMode === 'pct' ? tm.pctUrgM : tm.urgM.toLocaleString('es-AR')}
                        </td>
                        {/* Sin Urg. */}
                        <td className="px-1.5 py-1 text-right font-mono text-emerald-800">
                          {viewMode === 'pct' ? tm.pctSinUrg : tm.sinUrg.toLocaleString('es-AR')}
                        </td>
                        {/* Obito */}
                        <td className="px-1.5 py-1 text-right font-mono text-slate-700 border-r border-slate-300">
                          {viewMode === 'pct' ? tm.pctObito : tm.obito.toLocaleString('es-AR')}
                        </td>
                      </React.Fragment>
                    );
                  })}

                  {months.length > 1 && (
                    <>
                      <td className="px-1.5 py-1 text-right font-mono text-slate-900 font-bold bg-blue-100">
                        {totals.totalAtedia}
                      </td>
                      <td className="px-1.5 py-1 text-right font-mono text-slate-950 font-extrabold bg-blue-100">
                        {totals.totalCount.toLocaleString('es-AR')}
                      </td>
                      <td className="px-1.5 py-1 text-right font-mono text-slate-700 font-bold bg-blue-100">
                        {viewMode === 'pct' ? totals.totalPctSinAsi : totals.totalSinAsi.toLocaleString('es-AR')}
                      </td>
                      <td className="px-1.5 py-1 text-right font-mono text-rose-900 font-bold bg-blue-100">
                        {viewMode === 'pct' ? totals.totalPctResu : totals.totalResu.toLocaleString('es-AR')}
                      </td>
                      <td className="px-1.5 py-1 text-right font-mono text-red-800 font-bold bg-blue-100">
                        {viewMode === 'pct' ? totals.totalPctEmer : totals.totalEmer.toLocaleString('es-AR')}
                      </td>
                      <td className="px-1.5 py-1 text-right font-mono text-amber-800 font-bold bg-blue-100">
                        {viewMode === 'pct' ? totals.totalPctUrg : totals.totalUrg.toLocaleString('es-AR')}
                      </td>
                      <td className="px-1.5 py-1 text-right font-mono text-yellow-800 font-bold bg-blue-100">
                        {viewMode === 'pct' ? totals.totalPctUrgM : totals.totalUrgM.toLocaleString('es-AR')}
                      </td>
                      <td className="px-1.5 py-1 text-right font-mono text-emerald-900 font-bold bg-blue-100">
                        {viewMode === 'pct' ? totals.totalPctSinUrg : totals.totalSinUrg.toLocaleString('es-AR')}
                      </td>
                      <td className="px-1.5 py-1 text-right font-mono text-slate-800 font-bold bg-blue-100">
                        {viewMode === 'pct' ? totals.totalPctObito : totals.totalObito.toLocaleString('es-AR')}
                      </td>
                    </>
                  )}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}
