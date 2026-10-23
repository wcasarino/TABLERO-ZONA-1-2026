import React, { useMemo, useState, useRef } from 'react';
import { Filters } from '../types';
import { getMesName, sortMeses, cn } from '../lib/utils';
import DownloadPdfButton from './DownloadPdfButton';
import DownloadExcelButton from './DownloadExcelButton';
import { Search, Percent, Hash, ChevronDown, ChevronUp } from 'lucide-react';

export type DimensionKey = 'caps' | 'dpto' | 'especialidad' | 'profesional';

interface Props {
  data: any[];
  dimensionKey: DimensionKey;
  title: string;
  col1Label: string;
  isPrinting?: boolean;
  setFilters?: React.Dispatch<React.SetStateAction<Filters>>;
  defaultCollapsed?: boolean;
}

interface MonthMetrics {
  count: number;
  sinTurno: number;
  conTurno: number;
  pctSinTurno: string;
  pctConTurno: string;
  bot: number;
  call: number;
  caps: number;
  pctCaps: string;
  pctBot: string;
  pctCall: string;
}

interface MonthlyRow {
  name: string;
  totalCount: number;
  totalSinTurno: number;
  totalConTurno: number;
  totalPctSinTurno: string;
  totalPctConTurno: string;
  totalBot: number;
  totalCall: number;
  totalCaps: number;
  totalPctCaps: string;
  totalPctBot: string;
  totalPctCall: string;
  byMonth: Record<string, MonthMetrics>;
}

export default function TurnosMensualesTable({
  data,
  dimensionKey,
  title,
  col1Label,
  isPrinting = false,
  setFilters,
  defaultCollapsed = false,
}: Props) {
  const tableRef = useRef<HTMLDivElement>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'pct' | 'raw'>('pct');
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

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

  // 2. Agrupar por la dimensión seleccionada (CAPS, DPTO, ESPECIALIDAD, PROFESIONAL) y por Mes
  const { rows, totals } = useMemo(() => {
    if (!data || data.length === 0 || months.length === 0) {
      return { rows: [], totals: null };
    }

    const dimMap = new Map<string, {
      name: string;
      totalCount: number;
      totalSinTurno: number;
      totalConTurno: number;
      totalBot: number;
      totalCall: number;
      byMonth: Record<string, { count: number; sinTurno: number; conTurno: number; bot: number; call: number }>;
    }>();

    // Estructura para totales generales y por mes
    const monthTotalsAccum: Record<string, { count: number; sinTurno: number; conTurno: number; bot: number; call: number }> = {};
    months.forEach(m => {
      monthTotalsAccum[m] = { count: 0, sinTurno: 0, conTurno: 0, bot: 0, call: 0 };
    });
    let grandTotalCount = 0;
    let grandTotalSinTurno = 0;
    let grandTotalConTurno = 0;
    let grandTotalBot = 0;
    let grandTotalCall = 0;

    data.forEach(d => {
      const rawDimVal = d[dimensionKey];
      const dimName = (rawDimVal !== undefined && rawDimVal !== null && String(rawDimVal).trim() !== '')
        ? String(rawDimVal).trim()
        : 'Desconocido';

      const m = getMesName(d.fecha);
      if (!m || !monthTotalsAccum[m]) return;

      if (!dimMap.has(dimName)) {
        const initialByMonth: Record<string, { count: number; sinTurno: number; conTurno: number; bot: number; call: number }> = {};
        months.forEach(mo => {
          initialByMonth[mo] = { count: 0, sinTurno: 0, conTurno: 0, bot: 0, call: 0 };
        });
        dimMap.set(dimName, {
          name: dimName,
          totalCount: 0,
          totalSinTurno: 0,
          totalConTurno: 0,
          totalBot: 0,
          totalCall: 0,
          byMonth: initialByMonth
        });
      }

      const entry = dimMap.get(dimName)!;
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

      // Sin Turno
      let sinTurno = 0;
      if (d.sinTurno !== undefined && d.sinTurno !== null && !isNaN(Number(d.sinTurno)) && String(d.sinTurno).trim() !== '') {
        sinTurno = Number(d.sinTurno) || 0;
      } else if (String(d.tipo || '').toUpperCase().includes('SIN TURNO')) {
        sinTurno = atenciones;
      } else {
        sinTurno = Math.max(0, atenciones - conTurno);
      }
      entry.totalSinTurno += sinTurno;
      entry.byMonth[m].sinTurno += sinTurno;
      monthTotalsAccum[m].sinTurno += sinTurno;
      grandTotalSinTurno += sinTurno;

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

    const calculatedRows: MonthlyRow[] = Array.from(dimMap.values()).map(entry => {
      const totalCaps = Math.max(0, entry.totalConTurno - entry.totalBot - entry.totalCall);
      const totalPctSinTurno = entry.totalCount > 0 ? Math.round((entry.totalSinTurno / entry.totalCount) * 100) + '%' : '0%';
      const totalPctConTurno = entry.totalCount > 0 ? Math.round((entry.totalConTurno / entry.totalCount) * 100) + '%' : '0%';
      const totalPctCaps = entry.totalConTurno > 0 ? Math.round((totalCaps / entry.totalConTurno) * 100) + '%' : '0%';
      const totalPctBot = entry.totalConTurno > 0 ? Math.round((entry.totalBot / entry.totalConTurno) * 100) + '%' : '0%';
      const totalPctCall = entry.totalConTurno > 0 ? Math.round((entry.totalCall / entry.totalConTurno) * 100) + '%' : '0%';

      const byMonthProcessed: Record<string, MonthMetrics> = {};
      months.forEach(m => {
        const mData = entry.byMonth[m] || { count: 0, sinTurno: 0, conTurno: 0, bot: 0, call: 0 };
        const capsVal = Math.max(0, mData.conTurno - mData.bot - mData.call);
        byMonthProcessed[m] = {
          count: mData.count,
          sinTurno: mData.sinTurno,
          conTurno: mData.conTurno,
          pctSinTurno: mData.count > 0 ? Math.round((mData.sinTurno / mData.count) * 100) + '%' : '0%',
          pctConTurno: mData.count > 0 ? Math.round((mData.conTurno / mData.count) * 100) + '%' : '0%',
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
        totalSinTurno: entry.totalSinTurno,
        totalConTurno: entry.totalConTurno,
        totalPctSinTurno,
        totalPctConTurno,
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

    // Totales generales
    const grandTotalCaps = Math.max(0, grandTotalConTurno - grandTotalBot - grandTotalCall);
    const byMonthTotalsProcessed: Record<string, MonthMetrics> = {};
    months.forEach(m => {
      const mData = monthTotalsAccum[m];
      const capsVal = Math.max(0, mData.conTurno - mData.bot - mData.call);
      byMonthTotalsProcessed[m] = {
        count: mData.count,
        sinTurno: mData.sinTurno,
        conTurno: mData.conTurno,
        pctSinTurno: mData.count > 0 ? Math.round((mData.sinTurno / mData.count) * 100) + '%' : '0%',
        pctConTurno: mData.count > 0 ? Math.round((mData.conTurno / mData.count) * 100) + '%' : '0%',
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
      totalSinTurno: grandTotalSinTurno,
      totalConTurno: grandTotalConTurno,
      totalPctSinTurno: grandTotalCount > 0 ? Math.round((grandTotalSinTurno / grandTotalCount) * 100) + '%' : '0%',
      totalPctConTurno: grandTotalCount > 0 ? Math.round((grandTotalConTurno / grandTotalCount) * 100) + '%' : '0%',
      totalBot: grandTotalBot,
      totalCall: grandTotalCall,
      totalCaps: grandTotalCaps,
      totalPctCaps: grandTotalConTurno > 0 ? Math.round((grandTotalCaps / grandTotalConTurno) * 100) + '%' : '0%',
      totalPctBot: grandTotalConTurno > 0 ? Math.round((grandTotalBot / grandTotalConTurno) * 100) + '%' : '0%',
      totalPctCall: grandTotalConTurno > 0 ? Math.round((grandTotalCall / grandTotalConTurno) * 100) + '%' : '0%',
      byMonth: byMonthTotalsProcessed
    };

    return { rows: calculatedRows, totals: calculatedTotals };
  }, [data, dimensionKey, months]);

  // Filtrado por buscador
  const filteredRows = useMemo(() => {
    if (!searchTerm.trim()) return rows;
    const term = searchTerm.trim().toLowerCase();
    return rows.filter(r => r.name.toLowerCase().includes(term));
  }, [rows, searchTerm]);

  // Datos para exportar a Excel (Orden exacto: Cant, Sin Turno, Con Turno, CAPS, BOT, CALL)
  const excelData = useMemo(() => {
    return filteredRows.map(r => {
      const obj: Record<string, any> = { [col1Label]: r.name };
      months.forEach(m => {
        const mm = r.byMonth[m];
        if (viewMode === 'pct') {
          obj[`${m} - Cant`] = mm ? mm.count : 0;
          obj[`${m} - Sin Turno`] = mm ? mm.pctSinTurno : '0%';
          obj[`${m} - Con Turno`] = mm ? mm.pctConTurno : '0%';
          obj[`${m} - CAPS`] = mm ? mm.pctCaps : '0%';
          obj[`${m} - BOT`] = mm ? mm.pctBot : '0%';
          obj[`${m} - CALL`] = mm ? mm.pctCall : '0%';
        } else {
          obj[`${m} - Cant`] = mm ? mm.count : 0;
          obj[`${m} - Sin Turno (cant)`] = mm ? mm.sinTurno : 0;
          obj[`${m} - Con Turno (cant)`] = mm ? mm.conTurno : 0;
          obj[`${m} - CAPS (cant)`] = mm ? mm.caps : 0;
          obj[`${m} - BOT (cant)`] = mm ? mm.bot : 0;
          obj[`${m} - CALL (cant)`] = mm ? mm.call : 0;
        }
      });
      if (months.length > 1) {
        if (viewMode === 'pct') {
          obj['Total - Cant'] = r.totalCount;
          obj['Total - Sin Turno'] = r.totalPctSinTurno;
          obj['Total - Con Turno'] = r.totalPctConTurno;
          obj['Total - CAPS'] = r.totalPctCaps;
          obj['Total - BOT'] = r.totalPctBot;
          obj['Total - CALL'] = r.totalPctCall;
        } else {
          obj['Total - Cant'] = r.totalCount;
          obj['Total - Sin Turno (cant)'] = r.totalSinTurno;
          obj['Total - Con Turno (cant)'] = r.totalConTurno;
          obj['Total - CAPS (cant)'] = r.totalCaps;
          obj['Total - BOT (cant)'] = r.totalBot;
          obj['Total - CALL (cant)'] = r.totalCall;
        }
      }
      return obj;
    });
  }, [filteredRows, col1Label, months, viewMode]);

  if (!data || data.length === 0 || months.length === 0) {
    return null;
  }

  const exportFilename = `turnos-mensuales-por-${dimensionKey}`;
  const exportSheetName = `Turnos Mensuales ${col1Label}`;

  return (
    <div
      ref={tableRef}
      className={cn(
        "bg-white border border-slate-200 rounded shadow-xs mb-2 transition-all",
        isPrinting ? "h-auto overflow-visible block" : (isCollapsed ? "h-auto" : "flex flex-col h-64 overflow-hidden")
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
            {title}
          </h3>
          <span className="text-[9px] font-semibold text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full">
            {filteredRows.length} {col1Label}
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
                title="Mostrar canales y tipos en porcentajes"
              >
                <Percent className="w-2.5 h-2.5" /> %
              </button>
              <button
                onClick={() => setViewMode('raw')}
                className={cn(
                  "px-2 py-0.5 rounded transition-all flex items-center gap-0.5 cursor-pointer",
                  viewMode === 'raw' ? "bg-white text-blue-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
                )}
                title="Mostrar cantidades absolutas"
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
                placeholder={`Buscar ${col1Label}...`}
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
                filename={exportFilename}
                sheetName={exportSheetName}
              />
              <DownloadPdfButton
                targetRef={tableRef}
                filename={exportFilename}
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
                  {col1Label}
                </th>
                {months.map(m => (
                  <th
                    key={m}
                    colSpan={6}
                    className="px-2 py-1 font-bold text-slate-800 text-center uppercase tracking-tight border-r border-slate-300 bg-slate-200/95 text-[10px]"
                  >
                    {m}
                  </th>
                ))}
                {months.length > 1 && (
                  <th
                    colSpan={6}
                    className="px-2 py-1 font-bold text-blue-900 text-center uppercase tracking-tight bg-blue-100/95 border-l border-blue-200 text-[10px]"
                  >
                    TOTAL ACUMULADO
                  </th>
                )}
              </tr>

              {/* Encabezado Fila 2: Subcolumnas en el orden exacto solicitado: Cant, Sin Turno, Con Turno, CAPS, BOT, CALL */}
              <tr className="border-b border-slate-300 bg-slate-100 text-[9px]">
                {months.map(m => (
                  <React.Fragment key={`${m}-sub`}>
                    <th className="px-1.5 py-1 font-bold text-slate-800 text-right w-12" title="Cantidad total de atenciones del mes">
                      Cant
                    </th>
                    <th className="px-1.5 py-1 font-bold text-amber-700 text-right w-12" title="Sin Turno">
                      Sin Turno
                    </th>
                    <th className="px-1.5 py-1 font-bold text-emerald-700 text-right w-12" title="Con Turno">
                      Con Turno
                    </th>
                    <th className="px-1.5 py-1 font-bold text-indigo-700 text-right w-11" title="Canal CAPS (% sobre Con Turno)">
                      CAPS
                    </th>
                    <th className="px-1.5 py-1 font-bold text-blue-700 text-right w-11" title="Canal BOT (% sobre Con Turno)">
                      BOT
                    </th>
                    <th className="px-1.5 py-1 font-bold text-purple-700 text-right border-r border-slate-300 w-11" title="Canal CALL (% sobre Con Turno)">
                      CALL
                    </th>
                  </React.Fragment>
                ))}

                {months.length > 1 && (
                  <>
                    <th className="px-1.5 py-1 font-bold text-slate-900 text-right bg-blue-50/80 w-12" title="Total general de atenciones">
                      Cant
                    </th>
                    <th className="px-1.5 py-1 font-bold text-amber-800 text-right bg-blue-50/80 w-12" title="Total Sin Turno">
                      Sin Turno
                    </th>
                    <th className="px-1.5 py-1 font-bold text-emerald-800 text-right bg-blue-50/80 w-12" title="Total Con Turno">
                      Con Turno
                    </th>
                    <th className="px-1.5 py-1 font-bold text-indigo-800 text-right bg-blue-50/80 w-11" title="Canal CAPS total">
                      CAPS
                    </th>
                    <th className="px-1.5 py-1 font-bold text-blue-800 text-right bg-blue-50/80 w-11" title="Canal BOT total">
                      BOT
                    </th>
                    <th className="px-1.5 py-1 font-bold text-purple-800 text-right bg-blue-50/80 w-11" title="Canal CALL total">
                      CALL
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
                  {/* Nombre de la dimensión */}
                  <td
                    className={cn(
                      "px-2 py-1 text-slate-800 font-medium border-r border-slate-200 sticky left-0 bg-inherit z-10",
                      isPrinting ? "whitespace-normal break-words" : "truncate max-w-[150px]",
                      setFilters && "cursor-pointer hover:text-blue-600 hover:font-bold"
                    )}
                    onDoubleClick={() => setFilters?.(prev => ({ ...prev, [dimensionKey]: [row.name] }))}
                    title={`${row.name} (Doble clic para filtrar)`}
                  >
                    {row.name}
                  </td>

                  {/* Columnas por Mes en el orden solicitado: Cant, Sin Turno, Con Turno, CAPS, BOT, CALL */}
                  {months.map(m => {
                    const mm = row.byMonth[m] || { 
                      count: 0, 
                      sinTurno: 0, 
                      conTurno: 0, 
                      pctSinTurno: '0%', 
                      pctConTurno: '0%', 
                      bot: 0, 
                      call: 0, 
                      caps: 0, 
                      pctCaps: '0%', 
                      pctBot: '0%', 
                      pctCall: '0%' 
                    };
                    const hasData = mm.count > 0;
                    return (
                      <React.Fragment key={`${row.name}-${m}`}>
                        {/* 1. Cant */}
                        <td className="px-1.5 py-1 text-right font-mono font-bold text-slate-800">
                          {mm.count.toLocaleString('es-AR')}
                        </td>

                        {/* 2. Sin Turno */}
                        <td
                          className={cn(
                            "px-1.5 py-1 text-right font-mono font-medium",
                            hasData && mm.sinTurno > 0 ? "text-amber-700" : "text-slate-300"
                          )}
                          title={`Sin Turno: ${mm.sinTurno.toLocaleString('es-AR')} (${mm.pctSinTurno} sobre total)`}
                        >
                          {hasData ? (viewMode === 'pct' ? mm.pctSinTurno : mm.sinTurno.toLocaleString('es-AR')) : '-'}
                        </td>

                        {/* 3. Con Turno */}
                        <td
                          className={cn(
                            "px-1.5 py-1 text-right font-mono font-medium",
                            hasData && mm.conTurno > 0 ? "text-emerald-700" : "text-slate-300"
                          )}
                          title={`Con Turno: ${mm.conTurno.toLocaleString('es-AR')} (${mm.pctConTurno} sobre total)`}
                        >
                          {hasData ? (viewMode === 'pct' ? mm.pctConTurno : mm.conTurno.toLocaleString('es-AR')) : '-'}
                        </td>

                        {/* 4. CAPS */}
                        <td
                          className={cn(
                            "px-1.5 py-1 text-right font-mono font-medium",
                            hasData && mm.conTurno > 0 ? "text-indigo-700" : "text-slate-300"
                          )}
                          title={`Canal CAPS: ${mm.caps.toLocaleString('es-AR')} de ${mm.conTurno.toLocaleString('es-AR')} con turno`}
                        >
                          {hasData && mm.conTurno > 0 ? (viewMode === 'pct' ? mm.pctCaps : mm.caps.toLocaleString('es-AR')) : '-'}
                        </td>

                        {/* 5. BOT */}
                        <td
                          className={cn(
                            "px-1.5 py-1 text-right font-mono font-medium",
                            hasData && mm.conTurno > 0 ? "text-blue-700" : "text-slate-300"
                          )}
                          title={`Canal BOT: ${mm.bot.toLocaleString('es-AR')} de ${mm.conTurno.toLocaleString('es-AR')} con turno`}
                        >
                          {hasData && mm.conTurno > 0 ? (viewMode === 'pct' ? mm.pctBot : mm.bot.toLocaleString('es-AR')) : '-'}
                        </td>

                        {/* 6. CALL */}
                        <td
                          className={cn(
                            "px-1.5 py-1 text-right font-mono font-medium border-r border-slate-200",
                            hasData && mm.conTurno > 0 ? "text-purple-700" : "text-slate-300"
                          )}
                          title={`Canal CALL: ${mm.call.toLocaleString('es-AR')} de ${mm.conTurno.toLocaleString('es-AR')} con turno`}
                        >
                          {hasData && mm.conTurno > 0 ? (viewMode === 'pct' ? mm.pctCall : mm.call.toLocaleString('es-AR')) : '-'}
                        </td>
                      </React.Fragment>
                    );
                  })}

                  {/* Columnas de Total Acumulado */}
                  {months.length > 1 && (
                    <>
                      <td className="px-1.5 py-1 text-right font-mono font-bold text-slate-900 bg-blue-50/50">
                        {row.totalCount.toLocaleString('es-AR')}
                      </td>
                      <td 
                        className="px-1.5 py-1 text-right font-mono font-semibold text-amber-800 bg-blue-50/30"
                        title={`Total Sin Turno: ${row.totalSinTurno.toLocaleString('es-AR')} (${row.totalPctSinTurno})`}
                      >
                        {viewMode === 'pct' ? row.totalPctSinTurno : row.totalSinTurno.toLocaleString('es-AR')}
                      </td>
                      <td 
                        className="px-1.5 py-1 text-right font-mono font-semibold text-emerald-800 bg-blue-50/30"
                        title={`Total Con Turno: ${row.totalConTurno.toLocaleString('es-AR')} (${row.totalPctConTurno})`}
                      >
                        {viewMode === 'pct' ? row.totalPctConTurno : row.totalConTurno.toLocaleString('es-AR')}
                      </td>
                      <td 
                        className="px-1.5 py-1 text-right font-mono font-semibold text-indigo-800 bg-blue-50/30"
                        title={`Total Canal CAPS: ${row.totalCaps.toLocaleString('es-AR')}`}
                      >
                        {viewMode === 'pct' ? row.totalPctCaps : row.totalCaps.toLocaleString('es-AR')}
                      </td>
                      <td 
                        className="px-1.5 py-1 text-right font-mono font-semibold text-blue-800 bg-blue-50/30"
                        title={`Total Canal BOT: ${row.totalBot.toLocaleString('es-AR')}`}
                      >
                        {viewMode === 'pct' ? row.totalPctBot : row.totalBot.toLocaleString('es-AR')}
                      </td>
                      <td 
                        className="px-1.5 py-1 text-right font-mono font-semibold text-purple-800 bg-blue-50/30"
                        title={`Total Canal CALL: ${row.totalCall.toLocaleString('es-AR')}`}
                      >
                        {viewMode === 'pct' ? row.totalPctCall : row.totalCall.toLocaleString('es-AR')}
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
                        {/* Cant */}
                        <td className="px-1.5 py-1 text-right font-mono text-slate-900 font-extrabold">
                          {tm.count.toLocaleString('es-AR')}
                        </td>
                        {/* Sin Turno */}
                        <td className="px-1.5 py-1 text-right font-mono text-amber-900 font-bold" title="Sin Turno global del mes">
                          {viewMode === 'pct' ? tm.pctSinTurno : tm.sinTurno.toLocaleString('es-AR')}
                        </td>
                        {/* Con Turno */}
                        <td className="px-1.5 py-1 text-right font-mono text-emerald-900 font-bold" title="Con Turno global del mes">
                          {viewMode === 'pct' ? tm.pctConTurno : tm.conTurno.toLocaleString('es-AR')}
                        </td>
                        {/* CAPS */}
                        <td className="px-1.5 py-1 text-right font-mono text-indigo-900 font-bold" title="Canal CAPS global del mes">
                          {viewMode === 'pct' ? tm.pctCaps : tm.caps.toLocaleString('es-AR')}
                        </td>
                        {/* BOT */}
                        <td className="px-1.5 py-1 text-right font-mono text-blue-900 font-bold" title="Canal BOT global del mes">
                          {viewMode === 'pct' ? tm.pctBot : tm.bot.toLocaleString('es-AR')}
                        </td>
                        {/* CALL */}
                        <td className="px-1.5 py-1 text-right font-mono text-purple-900 font-bold border-r border-slate-300" title="Canal CALL global del mes">
                          {viewMode === 'pct' ? tm.pctCall : tm.call.toLocaleString('es-AR')}
                        </td>
                      </React.Fragment>
                    );
                  })}

                  {months.length > 1 && (
                    <>
                      <td className="px-1.5 py-1 text-right font-mono text-slate-950 font-extrabold bg-blue-100">
                        {totals.totalCount.toLocaleString('es-AR')}
                      </td>
                      <td className="px-1.5 py-1 text-right font-mono text-amber-950 font-bold bg-blue-100">
                        {viewMode === 'pct' ? totals.totalPctSinTurno : totals.totalSinTurno.toLocaleString('es-AR')}
                      </td>
                      <td className="px-1.5 py-1 text-right font-mono text-emerald-950 font-bold bg-blue-100">
                        {viewMode === 'pct' ? totals.totalPctConTurno : totals.totalConTurno.toLocaleString('es-AR')}
                      </td>
                      <td className="px-1.5 py-1 text-right font-mono text-indigo-950 font-bold bg-blue-100">
                        {viewMode === 'pct' ? totals.totalPctCaps : totals.totalCaps.toLocaleString('es-AR')}
                      </td>
                      <td className="px-1.5 py-1 text-right font-mono text-blue-950 font-bold bg-blue-100">
                        {viewMode === 'pct' ? totals.totalPctBot : totals.totalBot.toLocaleString('es-AR')}
                      </td>
                      <td className="px-1.5 py-1 text-right font-mono text-purple-950 font-bold bg-blue-100">
                        {viewMode === 'pct' ? totals.totalPctCall : totals.totalCall.toLocaleString('es-AR')}
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
