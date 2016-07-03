/* convert simple markup to tag */
/* give warning for */
var PBLINE=[];
var initpage="6.1";
var fs=require("./socketfs");
var doc=null;
var footnote=null;

var init=function(){
	var c=fs.readFile("footnote.json",function(err,data){
		footnote=JSON.parse(data);
		console.log(Object.keys(footnote).length);	
	});
}
var onTagClick=function(e) {
		var marker=e.target.marker;
		var pos=marker.find();
		doc.setCursor(pos.to);
		doc.cm.focus();
		marker.clear();
}

var markparagraph=function(content){
	return content.replace(/ (\d+\.)/g,function(m,m1){
		return "^"+m1;
	})
}
var footnotepat=/([a-zA-ZāĀīĪūŪṃṂṅṄñÑṭṬḍḌṇṆḷḶḥḤṛṚśŚṣṢṝṜḹḸ,.{}'”’\-:]{2,})(\d+)([! .?\-”])/g;
var markfootnote=function(content){
	return content.replace(footnotepat,function(m,w,n,e){
		return w+"#"+n+e;
	});
}
var automark=function(content){
	var content=markparagraph(content);
	content=markfootnote(content);
	return content;
}
var warnings={};

var showWarnings=function(newwarnings){
	
	for (var line in warnings) {
		if (!newwarnings[line])	{
			if (warnings[line].widget) warnings[line].widget.clear();
		}
	}

	for (var line in newwarnings) {
		if (!newwarnings[line].widget) {
			var m=createMarker("warning",newwarnings[line].message);
			var w=doc.addLineWidget(parseInt(line),m,{above:true});			
			newwarnings[line].widget=w;				
		}
	}
}
/* wrong foot note*/
var getWarnings=function(content){
	var out={};
	var lines=content.split("\n");
	var note=1,prevpg;
	for (var i=0;i<lines.length;i++) {
		var line=lines[i];
		var m=line.match(/~(\d+)\.(\d+)/);
		if (m) {
			if (footnote[prevpg] && footnote[prevpg].length!==note) {
				if (warnings[i]&&warnings[i].widget)warnings[i].widget.clear();
				out[i]={message:"footnote count missmatch "+footnote[prevpg].length+"!="+note};
			}
			prevpg=m[1]+"."+m[2];
			note=1;
		}

		line.replace(/#(\d+)/g,function(m,m1){
			var fn=parseInt(m1);
			if ((note+1)!==fn && note!==fn) {
				if (warnings[i]&&warnings[i].widget)warnings[i].widget.clear();
				out[i]={message:"previouse footnote "+note};
			}
			note=fn;
		})
	}
	
	return out;
}
var validateMark=function(content){
	var newwarnings=getWarnings(content);
	showWarnings(newwarnings);
	warnings=newwarnings;
	return Object.keys(warnings).length;
}

var createMarker=function(classname,tag) {
		var element=document.createElement("SPAN");
		element.className=classname;
		element.innerHTML=tag;
		element.onclick=onTagClick;
		return element;
}

var markLine=function(i,rebuild) {
		var line=doc.getLine(i);
		var dirty=false;
		line.replace(/~(\d+)\.(\d+)/g,function(m,vol,pg,idx){
			var element=createMarker("pbmarker",vol+"."+pg);
			var marker=doc.markText({line:i,ch:idx},{line:i,ch:idx+m.length},
				{clearOnEnter:true,replacedWith:element});
			element.marker=marker;
		});

		line.replace(/\^([0-9.]+)/g,function(m,m1,idx){
			var element=createMarker("paragraph",m1);
			var marker=doc.markText({line:i,ch:idx},{line:i,ch:idx+m.length},
				{clearOnEnter:true,replacedWith:element});
			element.marker=marker;
		});

		line.replace(/#(\d+)/g,function(m,m1,idx){
			var element=createMarker("footnote",m1);
			var marker=doc.markText({line:i,ch:idx},{line:i,ch:idx+m.length},
				{clearOnEnter:true,replacedWith:element});
			element.marker=marker;
		});

		line.replace(/\{(.+?)\}/g,function(m,m1,idx){
			var element=createMarker("correction",m1);
			var marker=doc.markText({line:i,ch:idx},{line:i,ch:idx+m.length},
				{clearOnEnter:true,replacedWith:element});
			element.marker=marker;
		});

		setTimeout(function(){
			if (rebuild && dirty) buildPBLINE();
		},100);//<pb id="1.2b"/>
	}

var getimagefilename=function(pageid) {
		var m=pageid.match(/(\d+)\.(\d+)/);
		vol=parseInt(m[1],10);
		pg="00"+(parseInt(m[2],10)+10);

		pg=pg.substr(pg.length-3);
		return "images/"+vol+"/"+pg+".png";
}
var markAllLine=function() {
	for (var i=0;i<doc.lineCount();i++){
		markLine(i);
	}
	buildPBLINE();
}

var buildPBLINE=function() {
		//var t=new Date();
		var marks=doc.getAllMarks();
		PBLINE=[];
		for (var i=0;i<marks.length;i++) {
			var m=marks[i];
			if (m.replacedWith.className=="pbmarker") {
				var pos=m.find();
				PBLINE.push([pos.from.line,m.replacedWith.innerHTML]);
			}
		}
		PBLINE.sort(function(a,b){
			return a[0]-b[0];
		});

		//console.log("rebuild pbline",new Date()-t);
	}
var setDoc=function(_doc){
	doc=_doc;
}
var getPageByLine=function(line) {
		for (var i=1;i<PBLINE.length;i++) {
			var pbline=PBLINE[i];
			if (pbline[0]>line) {
				return PBLINE[i-1][1];
			}
		}
		return PBLINE[PBLINE.length-1][1];//default
}
var getFootnote=function(str,pg){
	var m=str.match(/#(\d+)/);
	if (m){
		var footnoteinpage=footnote[pg];
		if (footnoteinpage){
			return pg+"#" +footnoteinpage[parseInt(m[1])-1];
		}
	}
	return "";
}
var nextWarning=function(ln){
	var lines=Object.keys(warnings);
	lines=lines.map(function(l){return parseInt(l)});
	lines.sort(function(a,b){return a-b});
	for (var i=0;i<lines.length;i++) {
		if (lines[i]>ln) return lines[i];
	}
	return 0;
}
module.exports={markAllLine,markLine,initpage,getimagefilename,setDoc
,getPageByLine,automark,validateMark,init,getFootnote,nextWarning};