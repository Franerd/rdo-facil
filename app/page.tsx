'use client';

import { useMemo, useState } from 'react';
const today = new Date().toISOString().slice(0, 10);

export default function Home() {
  const [data, setData] = useState({ obra: '', local: '', data: today, clima: 'Ensolarado', equipe: '', servicos: '', ocorrencias: '', equipamentos: '', observacoes: '' });
  const [copied, setCopied] = useState(false);
  const update = (field: keyof typeof data, value: string) => setData((current) => ({ ...current, [field]: value }));
  const report = useMemo(() => {
    const date = data.data ? new Date(`${data.data}T12:00:00`).toLocaleDateString('pt-BR') : '—';
    return `RELATÓRIO DIÁRIO DE OBRA\n\nObra: ${data.obra || '—'}\nLocal: ${data.local || '—'}\nData: ${date}\nCondições climáticas: ${data.clima || '—'}\nEquipe: ${data.equipe || '—'}\n\nSERVIÇOS EXECUTADOS\n${data.servicos || '—'}\n\nOCORRÊNCIAS\n${data.ocorrencias || 'Sem ocorrências.'}\n\nEQUIPAMENTOS UTILIZADOS\n${data.equipamentos || '—'}\n\nOBSERVAÇÕES\n${data.observacoes || '—'}`;
  }, [data]);
  async function copyReport() { await navigator.clipboard.writeText(report); setCopied(true); setTimeout(() => setCopied(false), 1800); }
  function shareWhatsApp() { window.open(`https://wa.me/?text=${encodeURIComponent(report)}`, '_blank', 'noopener,noreferrer'); }
  return (
    <main>
      <header className="topbar"><div className="brand"><span className="brandMark">R</span><div><strong>RDO Fácil</strong><small>Relatório Diário de Obra</small></div></div><span className="saved">● Dados somente neste aparelho</span></header>
      <section className="hero"><p className="eyebrow">REGISTRO DE CAMPO</p><h1>O dia da obra,<br /><em>bem documentado.</em></h1><p>Preencha os dados essenciais e tenha um relatório pronto para copiar, imprimir ou enviar.</p></section>
      <div className="workspace">
        <form className="formCard" onSubmit={(e) => e.preventDefault()}>
          <div className="sectionTitle"><span>01</span><div><h2>Identificação</h2><p>Informações básicas do registro</p></div></div>
          <div className="grid two"><label>Nome da obra<input value={data.obra} onChange={(e) => update('obra', e.target.value)} placeholder="Ex.: Rede de abastecimento — Setor 03" /></label><label>Local / trecho<input value={data.local} onChange={(e) => update('local', e.target.value)} placeholder="Rua, bairro ou estaca" /></label><label>Data<input type="date" value={data.data} onChange={(e) => update('data', e.target.value)} /></label><label>Condição do tempo<select value={data.clima} onChange={(e) => update('clima', e.target.value)}><option>Ensolarado</option><option>Nublado</option><option>Chuva leve</option><option>Chuva intensa</option><option>Tempo instável</option></select></label></div>
          <div className="sectionTitle"><span>02</span><div><h2>Produção do dia</h2><p>O que aconteceu em campo</p></div></div>
          <label>Equipe no local<input value={data.equipe} onChange={(e) => update('equipe', e.target.value)} placeholder="Ex.: 1 encarregado, 2 oficiais e 3 ajudantes" /></label>
          <label>Serviços executados<textarea value={data.servicos} onChange={(e) => update('servicos', e.target.value)} placeholder="Descreva os serviços, quantidades e trechos executados..." /></label>
          <label>Ocorrências<textarea value={data.ocorrencias} onChange={(e) => update('ocorrencias', e.target.value)} placeholder="Ex.: Condições climáticas adversas impactaram a execução dos serviços..." /></label>
          <div className="quick"><span>Sugestões rápidas:</span><button type="button" onClick={() => update('ocorrencias', 'Condições climáticas adversas (chuva) impactaram a execução dos serviços, devido ao acúmulo de água e à saturação do solo na área de trabalho.')}>Chuva</button><button type="button" onClick={() => update('ocorrencias', 'Interferência em ligação de água de residência durante a execução dos serviços, corrigida no local mediante emenda da tubulação.')}>Ligação de água</button><button type="button" onClick={() => update('ocorrencias', 'Não foram registradas ocorrências no período.')}>Sem ocorrências</button></div>
          <div className="sectionTitle"><span>03</span><div><h2>Complementos</h2><p>Recursos e observações finais</p></div></div>
          <div className="grid two"><label>Equipamentos utilizados<textarea value={data.equipamentos} onChange={(e) => update('equipamentos', e.target.value)} placeholder="Máquinas, veículos e ferramentas..." /></label><label>Observações<textarea value={data.observacoes} onChange={(e) => update('observacoes', e.target.value)} placeholder="Pendências ou informações adicionais..." /></label></div>
        </form>
        <aside className="previewCard"><div className="previewHead"><div><p>PRÉ-VISUALIZAÇÃO</p><h2>Relatório pronto</h2></div><span>RDO</span></div><pre>{report}</pre><div className="actions"><button className="primary" onClick={shareWhatsApp}>Enviar por WhatsApp</button><button onClick={copyReport}>{copied ? 'Copiado!' : 'Copiar texto'}</button><button onClick={() => window.print()}>Imprimir / PDF</button></div><p className="privacy">Seus dados não são enviados para nenhum servidor.</p></aside>
      </div>
    </main>
  );
}
