// ==APP-LOGIC-START==

// Makes typed text safe to show on the page.
// It swaps & < > for harmless codes, so typed HTML can never run as real code.
function escapeHtml(s){
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// Handles the small inline styles: `code`, **bold**, *italic*, __bold__, _italic_, and [links].
// The text coming in must already be made safe with escapeHtml above.
function mdInline(s){
  // s must already be HTML-escaped
  var codes=[]; // this list will hold the finished <code> pieces
  // Find `code` bits first and hide them behind placeholders,
  // so the bold/italic/link rules below can't mess them up.
  s=s.replace(/`([^`\n]+)`/g,function(m,c){
    codes.push('<code>'+c+'</code>'); // save the finished code chip
    return '\x00'+(codes.length-1)+'\x00'; // leave a placeholder where it was
  });
  // turn **bold** into bold HTML
  s=s.replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>');
  // turn *italic* into italic HTML
  s=s.replace(/(^|[^*])\*([^*\n]+)\*/g,'$1<em>$2</em>');
  // turn __bold__ into bold HTML
  s=s.replace(/__([^_]+)__/g,'<strong>$1</strong>');
  // turn _italic_ into italic HTML
  s=s.replace(/(^|[^_])_([^_\n]+)_/g,'$1<em>$2</em>');
  // turn [text](address) into a clickable link that opens in a new tab
  s=s.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g,function(m,t,u){
    u=u.replace(/"/g,'&quot;'); // keep quotes inside the address safe
    return '<a href="'+u+'" target="_blank" rel="noopener">'+t+'</a>';
  });
  // Put the saved `code` pieces back where their placeholders were.
  s=s.replace(/\x00(\d+)\x00/g,function(m,i){return codes[+i];});
  return s; // hand back the finished HTML
}

// The main markdown reader. Takes the whole typed text, returns finished HTML.
// It works in two passes: first pull out fenced code blocks, then read line by line.
function parseMarkdown(src){
  var fenced=[]; // this list will hold the fenced code blocks
  // Pull out ``` code blocks first and hide them behind placeholders,
  // so the line-by-line reader below doesn't touch them.
  src=src.replace(/```(\w*)\n([\s\S]*?)\n```/g,function(m,lang,code){
    fenced.push(code); // save the raw code
    return '\x01'+(fenced.length-1)+'\x01'; // leave a placeholder
  });
  // Split the rest into lines and get ready to build the HTML.
  var lines=src.split('\n'), html='', i=0, listBuf=null;
  // Writes out any list we were collecting (bullet or numbered).
  function flushList(){
    if(listBuf){ // only if we actually have a list waiting
      // Build the <ul> or <ol> with one <li> per collected item.
      html+='<'+listBuf.type+'>'+listBuf.items.map(function(it){
        return '<li>'+mdInline(escapeHtml(it))+'</li>';
      }).join('')+'</'+listBuf.type+'>';
      listBuf=null; // list is done, start fresh
    }
  }
  // Lines that always end a paragraph: headings, quotes, list items, rules, code blocks.
  var PARA_STOP=/^(#{1,6}\s|>\s?|\s*([-*+])\s|\s*\d+[.)]\s|(\*\*\*|---|___)\s*$|\x01\d+\x01)/;
  // Walk through the lines one by one.
  while(i<lines.length){
    var line=lines[i], m; // the current line, and a holder for pattern matches
    // Is this line a saved code block placeholder? Put the code block back.
    var fence=line.trim().match(/^\x01(\d+)\x01$/);
    if(fence){flushList();html+='<pre><code>'+escapeHtml(fenced[+fence[1]])+'</code></pre>';i++;continue;}
    // Blank line: end any open list and move on.
    if(/^\s*$/.test(line)){flushList();i++;continue;}
    // A heading line like "## Title": count the #'s to pick h1..h6.
    if(m=line.match(/^(#{1,6})\s+(.*)$/)){
      flushList();
      html+='<h'+m[1].length+'>'+mdInline(escapeHtml(m[2]))+'</h'+m[1].length+'>';
      i++;continue;
    }
    // A line of *** or --- or ___ becomes a horizontal rule.
    if(/^(\*\*\*|---|___)\s*$/.test(line.trim())){flushList();html+='<hr>';i++;continue;}
    // Lines starting with > are a quote: gather them all into one blockquote.
    if(/^>\s?/.test(line)){
      flushList();
      var bq=[]; // collects the quote's lines
      // Keep grabbing lines while they start with >.
      while(i<lines.length&&/^>\s?/.test(lines[i])){bq.push(lines[i].replace(/^>\s?/,''));i++;}
      // Each quote line becomes its own paragraph inside the quote box.
      html+='<blockquote>'+bq.map(function(l){
        return '<p>'+mdInline(escapeHtml(l))+'</p>';
      }).join('')+'</blockquote>';
      continue;
    }
    // A bullet list item (-, *, or +): add it to the list we're collecting.
    if(m=line.match(/^\s*([-*+])\s+(.*)$/)){
      // Start a new bullet list if we weren't already collecting one.
      if(!listBuf||listBuf.type!=='ul'){flushList();listBuf={type:'ul',items:[]};}
      listBuf.items.push(m[2]);i++;continue; // save the item text
    }
    // A numbered list item (1. 2. ...): add it to the list we're collecting.
    if(m=line.match(/^\s*(\d+)[.)]\s+(.*)$/)){
      // Start a new numbered list if we weren't already collecting one.
      if(!listBuf||listBuf.type!=='ol'){flushList();listBuf={type:'ol',items:[]};}
      listBuf.items.push(m[2]);i++;continue; // save the item text
    }
    // Anything else is a paragraph: gather lines until a blank or special line.
    flushList();
    var para=[]; // collects this paragraph's lines
    while(i<lines.length&&!/^\s*$/.test(lines[i])&&!PARA_STOP.test(lines[i])){
      para.push(lines[i]);i++;
    }
    // Join the lines (line breaks become <br>) and wrap in <p>.
    html+='<p>'+mdInline(escapeHtml(para.join('\n'))).replace(/\n/g,'<br>')+'</p>';
  }
  flushList(); // write out any list still waiting at the very end
  return html; // hand back the finished HTML
}
// ==APP-LOGIC-END==

// Everything below only runs in a browser (not when testing the logic in Node).
if(typeof document!=='undefined'){
  // Grab the three page pieces we need: the typing box, the preview box.
  var srcEl=document.getElementById('src');
  var prevEl=document.getElementById('preview');
  // A friendly tour text that shows when the page first opens.
  var SAMPLE=[
    '# Markdown Live','',
    'Type on the left — watch it render **instantly** on the right.','',
    '## Text styles','',
    'Make words **bold**, *italic*, or `code`. Even ***both***.',
    'Add [links](https://example.com "optional title") anywhere.','',
    '## Lists','',
    '- Apples','- Oranges','- Bananas','',
    '1. First','2. Second','3. Third','',
    '## Code blocks','',
    '```js','function hello() {','  return "<b>escaped</b> & safe";','}','```','',
    '## Quotes & rules','',
    '> Stay hungry, stay foolish.','',
    '---','',
    'That\u2019s the tour — now delete this and write your own.'
  ].join('\n'); // glue the lines together with line breaks
  // Re-renders the preview from whatever is typed right now.
  function render(){prevEl.innerHTML=parseMarkdown(srcEl.value);}
  srcEl.value=SAMPLE; // fill the typing box with the tour text
  srcEl.addEventListener('input',render); // re-render on every keystroke
  render(); // render once right away so the preview isn't empty
  // When the Copy HTML button is clicked, copy the preview's HTML.
  document.getElementById('copyHtml').addEventListener('click',function(){
    // Briefly change the button to "Copied!" so the user gets feedback.
    var done=function(){this.textContent='Copied!';var b=this;setTimeout(function(){b.textContent='Copy HTML';},1200);};
    // Use the modern clipboard tool if the browser has it...
    if(navigator.clipboard&&navigator.clipboard.writeText){
      navigator.clipboard.writeText(prevEl.innerHTML).then(done.bind(this)).catch(function(){fallback();});
    }else{fallback();} // ...otherwise use the old hidden-textarea trick below.
    // Old trick: make an invisible text box, select it, copy, remove it.
    function fallback(){
      var ta=document.createElement('textarea');
      ta.value=prevEl.innerHTML;document.body.appendChild(ta);ta.select();
      try{document.execCommand('copy');}catch(e){}
      document.body.removeChild(ta);done.call(this);
    }
  });
}
