(()=>{var e={};e.id=5620,e.ids=[5620],e.modules={3295:e=>{"use strict";e.exports=require("next/dist/server/app-render/after-task-async-storage.external.js")},10846:e=>{"use strict";e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},29294:e=>{"use strict";e.exports=require("next/dist/server/app-render/work-async-storage.external.js")},44870:e=>{"use strict";e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},63033:e=>{"use strict";e.exports=require("next/dist/server/app-render/work-unit-async-storage.external.js")},78335:()=>{},96487:()=>{},97515:(e,t,r)=>{"use strict";r.r(t),r.d(t,{patchFetch:()=>h,routeModule:()=>l,serverHooks:()=>g,workAsyncStorage:()=>u,workUnitAsyncStorage:()=>f});var o={};r.r(o),r.d(o,{GET:()=>p,POST:()=>d});var i=r(96559),n=r(48088),s=r(37719),a=r(32190);class c{async exportRecommendations(e,t={},r){let o={...this.defaultConfig,...t},i=this.generateExportId(),n=o.fileName||this.generateFileName(o.format,i);try{let t,s;switch(o.format){case"html":t=await this.exportRecommendationsToHTML(e,o,r),s=Buffer.byteLength(t,"utf8");break;case"pdf":s=(t=await this.exportRecommendationsToPDF(e,o,r)).length;break;case"csv":t=await this.exportRecommendationsToCSV(e,o),s=Buffer.byteLength(t,"utf8");break;case"json":t=this.exportRecommendationsToJSON(e,o,r),s=Buffer.byteLength(t,"utf8");break;case"text":t=this.exportRecommendationsToText(e,o,r),s=Buffer.byteLength(t,"utf8");break;default:throw Error(`Unsupported export format: ${o.format}`)}let a={exportId:i,exportedAt:new Date,format:o.format,fileName:n,fileSize:s,recommendationCount:e.length,sessionId:r?.sessionId,userProfile:o.userProfile};return{success:!0,metadata:a,content:t}}catch(t){return{success:!1,metadata:{exportId:i,exportedAt:new Date,format:o.format,fileName:n,recommendationCount:e.length,sessionId:r?.sessionId},error:t instanceof Error?t.message:"Unknown export error"}}}async exportRecommendationsToHTML(e,t,r){let o=this.generateHTMLHeader(t,r);for(let[i,n]of(t.includeSummary&&r?.overallAssessment&&(o+=this.generateHTMLSummary(r.overallAssessment,e)),Object.entries(this.groupRecommendations(e,t))))if(0!==n.length){for(let e of(o+=`<div class="recommendation-group">
`,o+=`<h2 class="group-title">${i}</h2>
`,n))o+=this.renderRecommendationToHTML(e,t);o+=`</div>
`}return o+this.generateHTMLFooter()}renderRecommendationToHTML(e,t){let r=e.priority.toLowerCase(),o=e.estimatedImpact.toLowerCase(),i=`<div class="recommendation-item priority-${r} impact-${o}">
`;return i+=`  <div class="recommendation-header">
    <h3 class="recommendation-title">${e.title}</h3>
    <div class="recommendation-badges">
      <span class="badge priority-${r}">${e.priority} Priority</span>
      <span class="badge impact-${o}">${e.estimatedImpact} Impact</span>
      <span class="badge effort-${e.estimatedEffort.toLowerCase()}">${e.estimatedEffort} Effort</span>
    </div>
  </div>
  <div class="recommendation-description">
    <p>${e.description}</p>
  </div>
`,t.includeMetrics&&(i+=`  <div class="recommendation-metrics">
    <div class="metric">
      <span class="metric-label">Time to Implement:</span>
      <span class="metric-value">${e.timeToImplement} hours</span>
    </div>
    <div class="metric">
      <span class="metric-label">Confidence:</span>
      <span class="metric-value">${Math.round(100*e.confidence)}%</span>
    </div>
    <div class="metric">
      <span class="metric-label">Priority Score:</span>
      <span class="metric-value">${e.priorityScore.toFixed(2)}</span>
    </div>
  </div>
`),t.includeActionSteps&&e.actionableSteps.length>0&&(i+=`  <div class="recommendation-actions">
    <h4>Action Steps:</h4>
    <ol class="action-steps">
`,e.actionableSteps.forEach(e=>{i+=`      <li>${e}</li>
`}),i+=`    </ol>
  </div>
`),e.evidence&&(i+=`  <div class="recommendation-evidence">
    <h4>Evidence:</h4>
    <p class="evidence-text">${e.evidence}</p>
  </div>
`),e.prerequisiteRecommendations&&e.prerequisiteRecommendations.length>0&&(i+=`  <div class="recommendation-prerequisites">
    <h4>Prerequisites:</h4>
    <ul class="prerequisites">
`,e.prerequisiteRecommendations.forEach(e=>{i+=`      <li>${e}</li>
`}),i+=`    </ul>
  </div>
`),i+=`</div>

`}async exportRecommendationsToPDF(e,t,r){let o=await this.exportRecommendationsToHTML(e,t,r),i=this.addPDFStyles(o);return Buffer.from(i,"utf8")}async exportRecommendationsToCSV(e,t){let r=[["ID","Title","Description","Category","Priority","Type","Impact","Effort","Time (hours)","Confidence (%)","Priority Score","Action Steps","Evidence","Prerequisites"]];return e.forEach(e=>{let t=[e.id,`"${e.title.replace(/"/g,'""')}"`,`"${e.description.replace(/"/g,'""')}"`,e.category,e.priority,e.type,e.estimatedImpact,e.estimatedEffort,e.timeToImplement.toString(),Math.round(100*e.confidence).toString(),e.priorityScore.toFixed(2),`"${e.actionableSteps.join("; ").replace(/"/g,'""')}"`,e.evidence?`"${e.evidence.replace(/"/g,'""')}"`:"",e.prerequisiteRecommendations?`"${e.prerequisiteRecommendations.join(", ")}"`:""];r.push(t)}),r.map(e=>e.join(",")).join("\n")}exportRecommendationsToJSON(e,t,r){return JSON.stringify({metadata:{exportedAt:new Date().toISOString(),format:"json",recommendationCount:e.length,sessionId:r?.sessionId,userProfile:t.userProfile},context:{overallAssessment:r?.overallAssessment,frameworkScore:r?.frameworkScore},recommendations:e,grouped:t.groupByPriority||t.groupByCategory?this.groupRecommendations(e,t):void 0,config:{includeMetrics:t.includeMetrics,includeTimeline:t.includeTimeline,includeSummary:t.includeSummary,includeActionSteps:t.includeActionSteps,groupByPriority:t.groupByPriority,groupByCategory:t.groupByCategory}},null,2)}exportRecommendationsToText(e,t,r){let o=`PITCH PERFECT - RECOMMENDATION REPORT
`;for(let[i,n]of(o+=`=====================================

Generated: ${new Date().toLocaleString()}
Total Recommendations: ${e.length}
`,r?.sessionId&&(o+=`Session ID: ${r.sessionId}
`),o+=`
`,t.includeSummary&&r?.overallAssessment&&(o+=`OVERALL ASSESSMENT
------------------
`,r.overallAssessment.competitivePosition&&(o+=`Competitive Position: ${r.overallAssessment.competitivePosition}
`),o+=`
Primary Strengths:
`,r.overallAssessment.primaryStrengths?.forEach(e=>{o+=`• ${e}
`}),o+=`
Primary Weaknesses:
`,r.overallAssessment.primaryWeaknesses?.forEach(e=>{o+=`• ${e}
`}),o+=`
`),Object.entries(this.groupRecommendations(e,t))))0!==n.length&&(o+=`${i.toUpperCase()}
${"-".repeat(i.length)}

`,n.forEach((e,r)=>{o+=`${r+1}. ${e.title}
   Priority: ${e.priority} | Impact: ${e.estimatedImpact} | Effort: ${e.estimatedEffort}
   Time to Implement: ${e.timeToImplement} hours
   Confidence: ${Math.round(100*e.confidence)}%

   Description:
   ${e.description}

`,t.includeActionSteps&&e.actionableSteps.length>0&&(o+=`   Action Steps:
`,e.actionableSteps.forEach((e,t)=>{o+=`   ${t+1}. ${e}
`}),o+=`
`),e.evidence&&(o+=`   Evidence: ${e.evidence}

`),o+=`   ---

`}));return o}generateExportId(){return`export_${Date.now()}_${Math.random().toString(36).substr(2,9)}`}generateFileName(e,t){let r=new Date().toISOString().split("T")[0];return`pitch-perfect-recommendations-${r}-${t}.${e}`}groupRecommendations(e,t){return t.groupByPriority?{"Critical Priority":e.filter(e=>"critical"===e.priority),"High Priority":e.filter(e=>"high"===e.priority),"Medium Priority":e.filter(e=>"medium"===e.priority),"Low Priority":e.filter(e=>"low"===e.priority)}:t.groupByCategory?{Speech:e.filter(e=>"speech"===e.category),Content:e.filter(e=>"content"===e.category),Visual:e.filter(e=>"visual"===e.category),Overall:e.filter(e=>"overall"===e.category),"Cross Category":e.filter(e=>"cross_category"===e.category)}:{"All Recommendations":e}}generateHTMLHeader(e,t){let r=e.title||"Pitch Perfect Recommendations";return`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${r}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background: #fff;
        }
        .header {
            text-align: center;
            border-bottom: 2px solid #e2e8f0;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .header h1 {
            color: #1e40af;
            margin: 0;
            font-size: 2.5rem;
        }
        .metadata {
            color: #64748b;
            font-size: 0.9rem;
            margin-top: 10px;
        }
        .summary {
            background: #f8fafc;
            border-left: 4px solid #3b82f6;
            padding: 20px;
            margin-bottom: 30px;
            border-radius: 0 8px 8px 0;
        }
        .group-title {
            color: #1e40af;
            border-bottom: 1px solid #cbd5e1;
            padding-bottom: 10px;
            margin-bottom: 20px;
            font-size: 1.5rem;
        }
        .recommendation-item {
            margin-bottom: 30px;
            page-break-inside: avoid;
        }
        .recommendation-group {
            margin-bottom: 40px;
        }
        @media print {
            body { margin: 0; }
            .recommendation-item { page-break-inside: avoid; }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>${r}</h1>
        <div class="metadata">
            Generated on ${new Date().toLocaleString()}
            ${t?.sessionId?` | Session: ${t.sessionId}`:""}
        </div>
    </div>
`}generateHTMLSummary(e,t){return`
    <div class="summary">
        <h2>Executive Summary</h2>
        <p><strong>Total Recommendations:</strong> ${t.length}</p>
        ${e.competitivePosition?`<p><strong>Competitive Position:</strong> ${e.competitivePosition}</p>`:""}
        
        <div style="margin-top: 20px;">
            <h3>Primary Strengths</h3>
            <ul>
                ${e.primaryStrengths?.map(e=>`<li>${e}</li>`).join("")||""}
            </ul>
        </div>
        
        <div style="margin-top: 20px;">
            <h3>Areas for Improvement</h3>
            <ul>
                ${e.primaryWeaknesses?.map(e=>`<li>${e}</li>`).join("")||""}
            </ul>
        </div>
    </div>
`}generateHTMLFooter(){return`
    <div style="margin-top: 50px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; color: #64748b; font-size: 0.8rem;">
        <p>Generated by Pitch Perfect Recommendation System</p>
        <p>Visit us at <a href="#">pitchperfect.ai</a></p>
    </div>
</body>
</html>`}addPDFStyles(e){let t=`
        <style>
            @page {
                margin: 1in;
                size: letter;
            }
            body {
                print-color-adjust: exact;
                -webkit-print-color-adjust: exact;
            }
            .recommendation-item {
                page-break-inside: avoid;
                break-inside: avoid;
            }
            .group-title {
                page-break-after: avoid;
            }
        </style>
    `;return e.replace("</head>",`${t}</head>`)}async exportToHTML(e){throw Error("Use exportRecommendations method instead")}async exportToPDF(e){throw Error("Use exportRecommendations method instead")}exportToJSON(e){throw Error("Use exportRecommendations method instead")}exportToCSV(e){throw Error("Use exportRecommendations method instead")}constructor(){this.defaultConfig={format:"html",includeMetrics:!0,includeTimeline:!1,includeSummary:!0,includeActionSteps:!0,groupByPriority:!1,groupByCategory:!1,title:"Pitch Perfect Recommendations"}}}let m=["html","pdf","csv","json","text"];async function d(e){try{let t=await e.json();if(!t.recommendations||!Array.isArray(t.recommendations))return a.NextResponse.json({error:"Invalid or missing recommendations array"},{status:400});if(!t.format||!m.includes(t.format))return a.NextResponse.json({error:`Invalid format. Supported formats: ${m.join(", ")}`},{status:400});if(0===t.recommendations.length)return a.NextResponse.json({error:"No recommendations provided for export"},{status:400});let r=new c,o=await r.exportRecommendations(t.recommendations,{...t.config,format:t.format},t.context);if(!o.success)return a.NextResponse.json({error:o.error||"Export failed"},{status:500});let i={html:"text/html",pdf:"application/pdf",csv:"text/csv",json:"application/json",text:"text/plain"}[t.format],n=o.metadata.fileName;if(e.headers.get("accept")?.includes("application/octet-stream")){let e=new Headers;return e.set("Content-Type",i),e.set("Content-Disposition",`attachment; filename="${n}"`),e.set("Content-Length",o.metadata.fileSize?.toString()||"0"),new a.NextResponse(o.content,{headers:e})}return a.NextResponse.json({success:!0,metadata:o.metadata,content:o.content instanceof Buffer?o.content.toString("base64"):o.content})}catch(e){return console.error("Export API error:",e),a.NextResponse.json({error:"Internal server error during export"},{status:500})}}async function p(){return a.NextResponse.json({supportedFormats:m,formatDescriptions:{html:"Rich HTML format with embedded styles, suitable for web viewing and printing",pdf:"PDF document format (requires server-side rendering)",csv:"Comma-separated values format for spreadsheet import",json:"Structured JSON format with full metadata and context",text:"Plain text format for basic reports and sharing"},defaultConfig:{includeMetrics:!0,includeTimeline:!1,includeSummary:!0,includeActionSteps:!0,groupByPriority:!0,groupByCategory:!1},maxRecommendations:100,version:"1.0.0"})}let l=new i.AppRouteRouteModule({definition:{kind:n.RouteKind.APP_ROUTE,page:"/api/export/route",pathname:"/api/export",filename:"route",bundlePath:"app/api/export/route"},resolvedPagePath:"/Users/jaredpace/Documents/code/pitch-perfect/app/api/export/route.ts",nextConfigOutput:"",userland:o}),{workAsyncStorage:u,workUnitAsyncStorage:f,serverHooks:g}=l;function h(){return(0,s.patchFetch)({workAsyncStorage:u,workUnitAsyncStorage:f})}}};var t=require("../../../webpack-runtime.js");t.C(e);var r=e=>t(t.s=e),o=t.X(0,[7719,580],()=>r(97515));module.exports=o})();