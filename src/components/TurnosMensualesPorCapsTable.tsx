import React, { useMemo, useState, useRef } from 'react';
import { Filters } from '../types';
import { getMesName, sortMeses, cn } from '../lib/utils';
import DownloadPdfButton from './DownloadPdfButton';
import DownloadExcelButton from './DownloadExcelButton';
import { Search, Percent, Hash } from 'lucide-react';

interface Props {
  data: any[];
  isPrinting?: boolean;
  setFilters?: React.Dispatch<React.SetStateAction<Filters>>;
}

interface MonthMetrics {
  count: number;
  conTurno: number;
  bot: number;
  call: number;
  caps: number;
  pctCaps: string;
  pctBot: string;
  pctCall: string;
}

interface CapsMonthlyRow {
  name: string;
  totalCount: number;
  totalConTurno: number;
  totalBot: number;
  totalCall: number;
  totalCaps: number;
  totalPctCaps: string;
  totalPctBot: string;
  totalPctCall: string;
  byMonth: Record<string, MonthMetrics>;
}

export default function TurnosMensualesPorCapsTable({
  data,
  isPrinting = false,
  setFilters,
}: Props) {
  const tableRef = useRef<HTMLDivElement>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'pct' | 'raw'>('pct');

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

  // 2. Agrupar por CAPS y por Mes
  const { rows, totals } = useMemo(() => {
    if (!data || data.length === 0 || months.length === 0) {
      return { rows: [], totals: null };
    }

    const capsMap = new Map<string, {
      name: string;
      totalCount: number;
      totalConTurno: number;
      totalBot: number;
      totalCall: number;
      byMonth: Record<string, { count: number; conTurno: number; bot: number; call: number }>;
    }>();

    // Estructura para totales generales y por mes
    const monthTotalsAccum: Record<string, { count: number; conTurno: number; bot: number; call: number }> = {};
    months.forEach(m => {
      monthTotalsAccum[m] = { count: 0, conTurno: 0, bot: 0, call: 0 };
    });
    let grandTotalCount = 0;
    let grandTotalConTurno = 0;
    let grandTotalBot = 0;
    let grandTotalCall = 0;

    data.forEach(d => {
      const caps = String(d.caps || 'Desconocido').trim();
      const m = getMesName(d.fecha);
      if (!m || !monthTotalsAccum[m]) return;

      if (!capsMap.has(caps)) {
        const initialByMonth: Record<string, { count: number; conTurno: number; bot: number; call: number }> = {};
        months.forEach(mo => {
          initialByMonth[mo] = { count: 0, conTurno: 0, bot: 0, call: 0 };
        });
        capsMap.set(caps, {
          name: caps,
          totalCount: 0,
          totalConTurno: 0,
          totalBot: 0,
          totalCall: 0,
          byMonth: initialByMonth
        });
      }

      const entry = capsMap.get(caps)!;
      const atenciones = Number(d.atenciones) || 0;

      entry.totalCount += atenciones;
      entry.byMonth[m].count += atenciones;
      monthTotalsAccum[m].count += atenciones;
      grandTotalCount += atenciones;

      // Con Turno
      let conTurno = 0;
      if (d.conTurno !== undefined && d.conTurno !== null && !isNaN(Number(d.conTurno)) && String(d.conTurno).trim() !== '') {
        conTurno = Number(d.conTurno) || 0;
      } else {
        const tipoStr = String(d.tipo || '').toUpperCase();
        if (tipoStr.includes('CON TURNO') || (!tipoStr.includes('SIN TURNO') && (tipoStr.includes('PROGRAM') || tipoStr.includes('SOBRE')))) {
          conTurno = atenciones;
        }
      }
      entry.totalConTurno += conTurno;
      entry.byMonth[m].conTurno += conTurno;
      monthTotalsAccum[m].conTurno += conTurno;
      grandTotalConTurno += conTurno;

      // BOT
      let bot = 0;
      if (d.canalBot !== undefined && d.canalBot !== null && !isNaN(Number(d.canalBot)) && String(d.canalBot).trim() !== '') {
        bot = Number(d.canalBot) || 0;
      } else if (String(d.anotador || '').toUpperCase().includes('BOT')) {
        bot = atenciones;
      }
      entry.totalBot += bot;
      entry.byMonth[m].bot += bot;
      monthTotalsAccum[m].bot += bot;
      grandTotalBot += bot;

      // CALL
      let call = 0;
      if (d.canalCall !== undefined && d.canalCall !== null && !isNaN(Number(d.canalCall)) && String(d.canalCall).trim() !== '') {
        call = Number(d.canalCall) || 0;
      } else if (String(d.anotador || '').toUpperCase().includes('CALL')) {
        call = atenciones;
      }
      entry.totalCall += call;
      entry.byMonth[m].call += call;
      monthTotalsAccum[m].call += call;
      grandTotalCall += call;
    });

    const calculatedRows: CapsMonthlyRow[] = Array.from(capsMap.values()).map(entry => {
      const totalCaps = Math.max(0, entry.totalConTurno - entry.totalBot - entry.totalCall);
      const totalPctCaps = entry.totalConTurno > 0 ? Math.round((totalCaps / entry.totalConTurno) * 100) + '%' : '0%';
      const totalPctBot = entry.totalConTurno > 0 ? Math.round((entry.totalBot / entry.totalConTurno) * 100) + '%' : '0%';
      const totalPctCall = entry.totalConTurno > 0 ? Math.round((entry.totalCall / entry.totalConTurno) * 100) + '%' : '0%';

      const byMonthProcessed: Record<string, MonthMetrics> = {};
      months.forEach(m => {
        const mData = entry.byMonth[m] || { count: 0, conTurno: 0, bot: 0, call: 0 };
        const capsVal = Math.max(0, mData.conTurno - mData.bot - mData.call);
        byMonthProcessed[m] = {
          count: mData.count,
          conTurno: mData.conTurno,
          bot: mData.bot,
          call: mData.call,
          caps: capsVal,
          pctCaps: mData.conTurno > 0 ? Math.round((capsVal / mData.conTurno) * 100) + '%' : '0%',
          pctBot: mData.conTurno > 0 ? Math.round((mData.bot / mData.conTurno) * 100) + '%' : '0%',
          pctCall: mData.conTurno > 0 ? Math.round((mData.call / mData.conTurno) * 100) + '%' : '0%',
        };
      });

      return {
        name: entry.name,
        totalCount: entry.totalCount,
        totalConTurno: entry.totalConTurno,
        totalBot: entry.totalBot,
        totalCall: entry.totalCall,
        totalCaps,
        totalPctCaps,
        totalPctBot,
        totalPctCall,
        byMonth: byMonthProcessed
      };
    });

    // Ordenar de mayor a menor por cantidad total
    calculatedRows.sort((a, b) => b.totalCount - a.totalCount);

    // Totales procesados
    const grandTotalCaps = Math.max(0, grandTotalConTurno - grandTotalBot - grandTotalCall);
    const byMonthTotalsProcessed: Record<string, MonthMetrics> = {};
    months.forEach(m => {
      const mData = monthTotalsAccum[m];
      const capsVal = Math.max(0, mData.conTurno - mData.bot - mData.call);
      byMonthTotalsProcessed[m] = {
        count: mData.count,
        conTurno: mData.conTurno,
        bot: mData.bot,
        call: mData.call,
        caps: capsVal,
        pctCaps: mData.conTurno > 0 ? Math.round((capsVal / mData.conTurno) * 100) + '%' : '0%',
        pctBot: mData.conTurno > 0 ? Math.round((mData.bot / mData.conTurno) * 100) + '%' : '0%',
        pctCall: mData.conTurno > 0 ? Math.round((mData.call / mData.conTurno) * 100) + '%' : '0%',
      };
    });

    const calculatedTotals = {
      totalCount: grandTotalCount,
      totalConTurno: grandTotalConTurno,
      totalBot: grandTotalBot,
      totalCall: grandTotalCall,
      totalCaps: grandTotalCaps,
      totalPctCaps: grandTotalConTurno > 0 ? Math.round((grandTotalCaps / grandTotalConTurno) * 100) + '%' : '0%',
      totalPctBot: grandTotalConTurno > 0 ? Math.round((grandTotalBot / grandTotalConTurno) * 100) + '%' : '0%',
      totalPctCall: grandTotalConTurno > 0 ? Math.round((grandTotalCall / grandTotalConTurno) * 100) + '%' : '0%',
      byMonth: byMonthTotalsProcessed
    };

    return { rows: calculatedRows, totals: calculatedTotals };
  }, [data, months]);

  // Filtrado por buscador
  const filteredRows = useMemo(() => {
    if (!searchTerm.trim()) return rows;
    const term = searchTerm.trim().toLowerCase();
    return rows.filter(r => r.name.toLowerCase().includes(term));
  }, [rows, searchTerm]);

  // Datos para exportar a Excel
  const excelData = useMemo(() => {
    return filteredRows.map(r => {
      const obj: Record<string, any> = { CAPS: r.name };
      months.forEach(m => {
        const mMetrics = r.byMonth[m];
        if (viewMode === 'pct') {
          obj[`${m} - CAPS`] = mMetrics ? mMetrics.pctCaps : '0%';
          obj[`${m} - BOT`] = mMetrics ? mMetrics.pctBot : '0%';
          obj[`${m} - CALL`] = mMetrics ? mMetrics.pctCall : '0%';
          obj[`${m} - Cant`] = mMetrics ? mMetrics.count : 0;
        } else {
          obj[`${m} - CAPS (cant)`] = mMetrics ? mMetrics.caps : 0;
          obj[`${m} - BOT (cant)`] = mMetrics ? mMetrics.bot : 0;
          obj[`${m} - CALL (cant)`] = mMetrics ? mMetrics.call : 0;
          obj[`${m} - Cant`] = mMetrics ? mMetrics.count : 0;
        }
      });
      if (months.length > 1) {
        if (viewMode === 'pct') {
          obj['Total - CAPS'] = r.totalPctCaps;
          obj['Total - BOT'] = r.totalPctBot;
          obj['Total - CALL'] = r.totalPctCall;
          obj['Total - Cant'] = r.totalCount;
        } else {
          obj['Total - CAPS (cant)'] = r.totalCaps;
          obj['Total - BOT (cant)'] = r.totalBot;
          obj['Total - CALL (cant)'] = r.totalCall;
          obj['Total - Cant'] = r.totalCount;
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
        "bg-white border border-slate-200 rounded shadow-xs mb-2",
        isPrinting ? "h-auto overflow-visible block" : "flex flex-col h-64 overflow-hidden"
      )}
    >
      {/* Header del Card */}
      <div className="bg-slate-50 px-3 py-2 border-b border-slate-200 flex flex-wrap justify-between items-center gap-2 shrink-0">
        <div className="flex items-center gap-2">
          <h3 className="font-bold uppercase text-[11px] text-slate-700 tracking-tight flex items-center gap-1.5">
            Turnos MENSUALES por CAPS
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
          <div className="flex items-center bg-slate-200 rounded p-0.5 text-[9px] font-bold">
            <button
              onClick={() => setViewMode('pct')}
              className={cn(
                "px-2 py-0.5 rounded transition-all flex items-center gap-0.5",
                viewMode === 'pct' ? "bg-white text-blue-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
              )}
              title="Mostrar canales en porcentaje (% sobre Con Turno)"
            >
              <Percent className="w-2.5 h-2.5" /> %
            </button>
            <button
              onClick={() => setViewMode('raw')}
              className={cn(
                "px-2 py-0.5 rounded transition-all flex items-center gap-0.5",
                viewMode === 'raw' ? "bg-white text-blue-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
              )}
              title="Mostrar canales en cantidad absoluta"
            >
              <Hash className="w-2.5 h-2.5" /> Cant
            </button>
          </div>

          {/* Buscador de CAPS */}
          {!isPrinting && (
            <div className="relative flex items-center">
              <Search className="w-3 h-3 text-slate-400 absolute left-2 pointer-events-none" />
              <input
                type="text"
                placeholder="Buscar CAPS..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="text-[10px] pl-6 pr-2 py-1 bg-white border border-slate-300 rounded text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 w-28 sm:w-36"
              />
            </div>
          )}

          {/* Botones de Descarga */}
          {!isPrinting && (
            <div className="flex items-center gap-1">
              <DownloadExcelButton
                data={excelData}
                filename="turnos-mensuales-por-caps"
                sheetName="Turnos Mensuales CAPS"
              />
              <DownloadPdfButton
                targetRef={tableRef}
                filename="turnos-mensuales-por-caps"
              />
            </div>
          )}
        </div>
      </div>

      {/* Contenedor de la Tabla */}
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
                className="px-2 py-1.5 font-bold text-slate-700 border-r border-slate-300 bg-slate-200 sticky left-0 z-20 min-w-[140px] uppercase tracking-wider"
              >
                CAPS
              </th>
              {months.map(m => (
                <th
                  key={m}
                  colSpan={4}
                  className="px-2 py-1 font-bold text-slate-800 text-center uppercase tracking-tight border-r border-slate-300 bg-slate-200/90 text-[10px]"
                >
                  {m}
                </th>
              ))}
              {months.length > 1 && (
                <th
                  colSpan={4}
                  className="px-2 py-1 font-bold text-blue-900 text-center uppercase tracking-tight bg-blue-100/90 border-l border-blue-200 text-[10px]"
                >
                  TOTAL ACUMULADO
                </th>
              )}
            </tr>

            {/* Encabezado Fila 2: Subcolumnas de Canales y Cant */}
            <tr className="border-b border-slate-300 bg-slate-100 text-[9px]">
              {months.map(m => (
                <React.Fragment key={`${m}-sub`}>
                  <th className="px-1.5 py-1 font-bold text-indigo-700 text-right w-11" title="% CAPS sobre Con Turno">
                    CAPS
                  </th>
                  <th className="px-1.5 py-1 font-bold text-blue-700 text-right w-11" title="% BOT sobre Con Turno">
                    BOT
                  </th>
                  <th className="px-1.5 py-1 font-bold text-purple-700 text-right w-11" title="% CALL sobre Con Turno">
                    CALL
                  </th>
                  <th className="px-1.5 py-1 font-bold text-slate-800 text-right border-r border-slate-300 w-12" title="Total atenciones del mes">
                    Cant
                  </th>
                </React.Fragment>
              ))}

              {months.length > 1 && (
                <>
                  <th className="px-1.5 py-1 font-bold text-indigo-800 text-right bg-blue-50/80 w-11" title="% CAPS total">
                    CAPS
                  </th>
                  <th className="px-1.5 py-1 font-bold text-blue-800 text-right bg-blue-50/80 w-11" title="% BOT total">
                    BOT
                  </th>
                  <th className="px-1.5 py-1 font-bold text-purple-800 text-right bg-blue-50/80 w-11" title="% CALL total">
                    CALL
                  </th>
                  <th className="px-1.5 py-1 font-bold text-slate-900 text-right bg-blue-50/80 w-12" title="Total general de atenciones">
                    Cant
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
                    isPrinting ? "whitespace-normal break-words" : "truncate max-w-[160px]",
                    setFilters && "cursor-pointer hover:text-blue-600 hover:font-bold"
                  )}
                  onDoubleClick={() => setFilters?.(prev => ({ ...prev, caps: [row.name] }))}
                  title={`${row.name} (Doble clic para filtrar)`}
                >
                  {row.name}
                </td>

                {/* Columnas por Mes */}
                {months.map(m => {
                  const mm = row.byMonth[m] || { count: 0, conTurno: 0, bot: 0, call: 0, caps: 0, pctCaps: '0%', pctBot: '0%', pctCall: '0%' };
                  const hasData = mm.count > 0;
                  return (
                    <React.Fragment key={`${row.name}-${m}`}>
                      <td
                        className={cn(
                          "px-1.5 py-1 text-right font-mono font-medium",
                          hasData ? "text-indigo-700" : "text-slate-300"
                        )}
                        title={`CAPS: ${mm.caps} de ${mm.conTurno} con turno`}
                      >
                        {hasData ? (viewMode === 'pct' ? mm.pctCaps : mm.caps) : '-'}
                      </td>
                      <td
                        className={cn(
                          "px-1.5 py-1 text-right font-mono font-medium",
                          hasData ? "text-blue-700" : "text-slate-300"
                        )}
                        title={`BOT: ${mm.bot} de ${mm.conTurno} con turno`}
                      >
                        {hasData ? (viewMode === 'pct' ? mm.pctBot : mm.bot) : '-'}
                      </td>
                      <td
                        className={cn(
                          "px-1.5 py-1 text-right font-mono font-medium",
                          hasData ? "text-purple-700" : "text-slate-300"
                        )}
                        title={`CALL: ${mm.call} de ${mm.conTurno} con turno`}
                      >
                        {hasData ? (viewMode === 'pct' ? mm.pctCall : mm.call) : '-'}
                      </td>
                      <td className="px-1.5 py-1 text-right font-mono font-bold text-slate-800 border-r border-slate-200">
                        {mm.count.toLocaleString('es-AR')}
                      </td>
                    </React.Fragment>
                  );
                })}

                {/* Columnas de Total Acumulado */}
                {months.length > 1 && (
                  <>
                    <td className="px-1.5 py-1 text-right font-mono font-bold text-indigo-800 bg-blue-50/30">
                      {viewMode === 'pct' ? row.totalPctCaps : row.totalCaps}
                    </td>
                    <td className="px-1.5 py-1 text-right font-mono font-bold text-blue-800 bg-blue-50/30">
                      {viewMode === 'pct' ? row.totalPctBot : row.totalBot}
                    </td>
                    <td className="px-1.5 py-1 text-right font-mono font-bold text-purple-800 bg-blue-50/30">
                      {viewMode === 'pct' ? row.totalPctCall : row.totalCall}
                    </td>
                    <td className="px-1.5 py-1 text-right font-mono font-bold text-slate-900 bg-blue-50/50">
                      {row.totalCount.toLocaleString('es-AR')}
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
                      <td className="px-1.5 py-1 text-right font-mono text-indigo-900" title="Promedio ponderado CAPS">
                        {viewMode === 'pct' ? tm.pctCaps : tm.caps.toLocaleString('es-AR')}
                      </td>
                      <td className="px-1.5 py-1 text-right font-mono text-blue-900" title="Promedio ponderado BOT">
                        {viewMode === 'pct' ? tm.pctBot : tm.bot.toLocaleString('es-AR')}
                      </td>
                      <td className="px-1.5 py-1 text-right font-mono text-purple-900" title="Promedio ponderado CALL">
                        {viewMode === 'pct' ? tm.pctCall : tm.call.toLocaleString('es-AR')}
                      </td>
                      <td className="px-1.5 py-1 text-right font-mono text-slate-900 font-bold border-r border-slate-300">
                        {tm.count.toLocaleString('es-AR')}
                      </td>
                    </React.Fragment>
                  );
                })}
                {months.length > 1 && (
                  <>
                    <td className="px-1.5 py-1 text-right font-mono text-indigo-950 bg-blue-100">
                      {viewMode === 'pct' ? totals.totalPctCaps : totals.totalCaps.toLocaleString('es-AR')}
                    </td>
                    <td className="px-1.5 py-1 text-right font-mono text-blue-950 bg-blue-100">
                      {viewMode === 'pct' ? totals.totalPctBot : totals.totalBot.toLocaleString('es-AR')}
                    </td>
                    <td className="px-1.5 py-1 text-right font-mono text-purple-950 bg-blue-100">
                      {viewMode === 'pct' ? totals.totalPctCall : totals.totalCall.toLocaleString('es-AR')}
                    </td>
                    <td className="px-1.5 py-1 text-right font-mono text-slate-950 font-extrabold bg-blue-100">
                      {totals.totalCount.toLocaleString('es-AR')}
                    </td>
                  </>
                )}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
