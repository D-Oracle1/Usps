var link = document.createElement('link');
link.setAttribute('rel', 'stylesheet');
link.setAttribute('type', 'text/css');
link.setAttribute('href', '/priority-mail/map/pm_map.css');
document.getElementsByTagName('head')[0].appendChild(link);

dojo.require("dijit.layout.BorderContainer");
dojo.require("dijit.layout.ContentPane");
dojo.require("dijit.layout.AccordionContainer");
dojo.require("esri.map");
dojo.require("esri.lang");
dojo.require("esri.layers.FeatureLayer");
dojo.require("esri.layers.graphics");
dojo.require("esri.renderer");
dojo.require("esri.tasks.gp");
dojo.require("esri.tasks.query");
dojo.require("dijit.form.Button");
dojo.require("esri.dijit.Print");
dojo.require("esri.symbols.PictureMarkerSymbol");
dojo.require("esri.symbols.SimpleMarkerSymbol");
dojo.require("esri.geometry.Point");
dojo.require("esri.graphic");
dojo.require("dojo.dom");
dojo.require("dojo.dom-construct");
dojo.require("dojo.domReady!");
dojo.require("esri.request");
dojo.require("esri.tasks.PrintTemplate");
dojo.require("esri.config");
dojo.require("dojo._base.array");
dojo.require("esri.arcgis.utils");
dojo.require("esri.layers.agsdynamic");
dojo.require("esri.layers.agstiled");
dojo.require("esri.geometry.Extent");
dojo.require("esri.layers.LOD");
dojo.require("esri.dijit.Legend");
dojo.require("esri.tasks.LegendLayer");
dojo.require("dojo.on"); 
dojo.require("esri.SpatialReference");
dojo.require("esri.symbols.SimpleFillSymbol");
dojo.require("esri.symbols.SimpleLineSymbol");
dojo.require("esri.renderers.SimpleRenderer");
dojo.require("esri.Color");
dojo.require("dojo.number");
dojo.require("dojo.dom-style");
dojo.require("dijit.TooltipDialog");
dojo.require("dijit.popup");
dojo.require("esri.geometry.Polygon");



var map;
var bufferLayer;
var pinLayer;
var StandardsResults;
var origzip3;
var origzip5;
var gp;
var lookupcount;
var currentZoom = 45254955.38108561;
var featureLayer;
var closeDialog;
var mapPos;
var uniqueValue;
function init(){
		
	lookupcount = 0;
		
	//buffer layer for lookup results
	bufferLayer = new esri.layers.GraphicsLayer({
   		id: "bufferLayer",
		opacity: 0.7
	});
	//dynamic map
    var psseLayerURL = "https://ssmap.usps.com/arcgis/rest/services/ServiceStandards/PMAP_Projected/MapServer";
    var psseLayer = new esri.layers.ArcGISDynamicMapServiceLayer(psseLayerURL, {
          id: "psseLayer",
		  opacity: 1.0	
    });
	//blue color layer
	var blueLayerUrl = "https://ssmap.usps.com/arcgis/rest/services/ServiceStandards/PMAP_ProjectedColor/MapServer";
  	var blueLayer = esri.layers.ArcGISDynamicMapServiceLayer(blueLayerUrl, { 
        id: "blueLayer",
		opacity: 1.0		
    });


	
	map = new esri.Map("mapDiv", { 
        center: [-98.34960937497242, 38.94989178680422],
        zoom: 4,
		maxScale:353554.3389147311,
		minScale:90509910.76217116,
		logo: false,
        basemap: 'streets'
	});
	featureLayer = new esri.layers.FeatureLayer(
	"https://ssmap.usps.com/arcgis/rest/services/ServiceStandards/PND_market/FeatureServer/0",
	{
	//mode: esri.layers.FeatureLayer.MODE_ONDEMAND,
	mode: esri.layers.FeatureLayer.MODE_SNAPSHOT,
	outFields: ["*"]
	}
	);
	//featureLayer.setDefinitionExpression("");
       var symbol = new esri.symbol.SimpleFillSymbol(
          esri.symbol.SimpleFillSymbol.STYLE_SOLID,
          new esri.symbol.SimpleLineSymbol(
            esri.symbol.SimpleLineSymbol.STYLE_SOLID,
            new esri.Color([255,255,255,0.35]),
            1
          ),
          new esri.Color([125,125,125,0.35])
        );
        //featureLayer.setRenderer(new esri.renderer.SimpleRenderer(symbol));
        //map.addLayer(featureLayer);
        dialog = new dijit.TooltipDialog({
          id: "tooltipDialog",
          style: "position: absolute; width: 250px; font: normal normal normal 10pt Helvetica;z-index:100"
        });
        dialog.startup();		
		
        // var highlightSymbol = new SimpleFillSymbol(
          // SimpleFillSymbol.STYLE_SOLID,
          // new SimpleLineSymbol(
            // SimpleLineSymbol.STYLE_SOLID,
            // new Color([255,0,0]), 3
          // ),
          // new Color([125,125,125,0.35])
        // );

 featureLayer.on("load", function(evt){dojo.require("esri.lang");
});

        //listen for when the onMouseOver event fires on the countiesGraphicsLayer
        //when fired, create a new graphic with the geometry from the event.graphic and add it to the maps graphics layer
        featureLayer.on("click", function(evt){
          mapPos = map.extent;
          closeDialog();
          var t = "<a href='#' type='button' class='close' tabindex='0'><span class='visuallyhidden'>Close Tooltip</span></a><h3>Priority Mail<sup>&reg;</sup> Next Day</h3><p><span>Next Day Delivery Eligible</span></p><hr /><p>Next Day Service reaches ${Total_Population:NumberFormat} people and ${Total_Business:NumberFormat} businesses in ZIP Code<sup>&trade;</sup> ${ZIP} and neighboring eligible ZIP Codes<sup>&trade;</sup>.</p><p><a class='locate-link' href='#' data-zip='${ZIP}'>See Details for this Market</a></p>";
var content;
			if (typeof(esri.lang)!='object') {
				dojo.require("esri.lang");
			} else {
	          content = esri.lang.substitute(evt.graphic.attributes,t);
            }
          // var highlightGraphic = new Graphic(evt.graphic.geometry,highlightSymbol);
          // map.graphics.add(highlightGraphic);

          dialog.setContent(content);

          //domStyle.set(dialog.domNode, "opacity", 0.85);
          dijit.popup.open({
            popup: dialog,
            x: evt.pageX,
            y: evt.pageY
          });
        });

        function closeDialog() {
          map.graphics.clear();
          dijit.popup.close(dialog);
        }
		
	//Click function that logs attributes to console
	map.on("click", function (evt) {
	  var tol = 10; // tolerance in screen pixels

	  // Convert screen point buffer to map extent
	  var screenPoint = map.toScreen(evt.mapPoint);
	  var topLeft = map.toMap({ x: screenPoint.x - tol, y: screenPoint.y - tol });
	  var bottomRight = map.toMap({ x: screenPoint.x + tol, y: screenPoint.y + tol });

	  var extent = new esri.geometry.Extent({
		xmin: topLeft.x,
		ymin: bottomRight.y,
		xmax: bottomRight.x,
		ymax: topLeft.y,
		spatialReference: map.spatialReference
	  });

	  var query = new esri.tasks.Query();
	  query.geometry = extent;
	  query.outFields = ["*"];
	  query.returnGeometry = false;

	  featureLayer.selectFeatures(query, esri.layers.FeatureLayer.SELECTION_NEW, function (features) {
		if (features.length > 0) {
		  console.log("Feature attributes:", features[0].attributes);
		} else {
          closeDialog();
		  console.log("No point features found at click.");
		}
	  });
	//close the dialog when the mouse leaves the highlight graphic
	map.graphics.enableMouseEvents();
	map.graphics.on("mouse-out", closeDialog);
	});

    

	map.addLayer(psseLayer,0);

	map.addLayer(blueLayer,1);	

	createPrintableButtonArea();
	//pin layer
	pinLayer = new esri.layers.GraphicsLayer({
   		id: "pinLayer"
	});

	map.addLayer(bufferLayer,2);

	map.addLayer(pinLayer, 3);

	createmapLegendDiv();
	
	createLoadingImgDiv();
  parameterCheck();
	dojo.connect(map, "onUpdateStart", function() {
    	esri.show(dojo.byId("loadingImg"));					 
    });
    dojo.connect(map, "onUpdateEnd", function() {
    	esri.hide(dojo.byId("loadingImg"));		
    });
	
	dojo.connect( map, "onZoomEnd", function(){	
		currentZoom = map.getScale();
	});
	
}



  // Function to call a REST API and display the results
  function callRestApi(apiUrl, attributeName) {
    fetch(apiUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
		"Access-Control-Allow-Origin" : "*"
      }
    })
      .then((response) => {
      return response.json(); // Parse the response as JSON
      })
      .then((data) => {

        const firstItem = data.results[0];
   	   uniqueValue = firstItem.value.fields[1].name;
       const features = firstItem.value.features;
        displayResults(features); // This will be displayResults in the current app and hopefully we won’t need to make too many changes
      })
      .catch((error) => {
        console.error("Error calling the REST API:", error);
      });
  }

//Search with origination ZIP	
function execute(originationzip, servicetype){
	//clear existing graphics 
	bufferLayer.clear();
	pinLayer.clear();
	map.removeLayer(featureLayer);
	
	if (lookupcount == 0) {		
		removeBlueColor();
		lookupcount = lookupcount + 1;
	}
	

    var origzip = originationzip;
	var classtype = servicetype.toLowerCase();
	// commented out changing zip to zip3 - this will allow zip 5 to exist (Keeping origzip3 var name to avoid changes elsewhere)

	if (origzip.length == 3) {
		origzip3 = origzip;
	} else if (origzip.length > 3) {
        origzip3 = origzip.substr(0, 3);
    }
	origzip5 = origzip;
	
	esri.show(dojo.byId("loadingImg"));
	
	
	gp = new esri.tasks.Geoprocessor("https://ssmap.usps.com/arcgis/rest/services/ServiceStandards/getStandardsMap/GPServer/getStandardsMap");
	
    gp.setOutputSpatialReference({
        wkid: 102100
    });

    var params = {
        "orig_zip": origzip3,
		"std_class": classtype
    };
    dijit.popup.close(dialog);
	if (classtype.toLowerCase() == "pnd"){
			params = {
			"orig_zip": origzip5,
			"std_class": "pnd"
		};
		gp.execute(params, displayResults, errorHandler);
	} else {
      const apiUrl = 'https://dangerousgoods.usps.com/dangerous-ws/country/callSSDService/'+origzip+'/'+classtype.toUpperCase();
		callRestApi(apiUrl, classtype.toUpperCase()); //how to call the function
	}
}
var testResults = null;
var testfeatureSet = null;

function displayResults(results, messages){	
	esri.hide(dojo.byId("loadingImg"));
	testResults = results;
	
    var defaultSymbol = new esri.symbol.SimpleFillSymbol().setStyle(esri.symbol.SimpleFillSymbol.STYLE_NULL);
    defaultSymbol.outline.setStyle(esri.symbol.SimpleLineSymbol.STYLE_NULL);
		testResults = results;
    //create renderer
	// remove hard coded type and grab from results
  // var renderer = new esri.renderer.UniqueValueRenderer(defaultSymbol, "ORIGIN_ENTRY_T_PRI_NBR");
  
  // if PND assume all returned features are next-day-eligible
  	if (dojo.byId('form-service').value == 'PND'){
	  var renderer = new esri.renderer.UniqueValueRenderer(defaultSymbol, results[0].value.fields[5].name);
	  //add symbol for each possible value
	  renderer.addValue("01", new esri.symbol.SimpleFillSymbol().setColor(new dojo.Color([243, 161, 209, 1.0])).setOutline(new esri.symbol.SimpleLineSymbol().setColor(new dojo.Color([243, 161, 209, 1.0])).setWidth(2)));
	  renderer.addValue("02", new esri.symbol.SimpleFillSymbol().setColor(new dojo.Color([168, 195, 221, 1.0])).setOutline(new esri.symbol.SimpleLineSymbol().setColor(new dojo.Color([168, 195, 221, 1.0])).setWidth(2)));
		$('#nd-ppl').text((parseFloat(results[0].value.features[0].attributes.PND_V5_Final_PRI_TOT_POP) / 1000000).toFixed(2)+"M");
		$('#nd-bus').text(addCommas(results[0].value.features[0].attributes.PND_V5_Final_PRI_TOT_BIZ));
		$('#nd-zip').text(results[0].value.features[0].attributes.PND_V5_Final_PRI_ZIP_COUNT);			
		$('#pu-ppl').text((parseFloat(results[0].value.features[0].attributes.PND_V5_Final_PU_TOT_POP) / 1000000).toFixed(2)+"M");
		$('#pu-bus').text(addCommas(results[0].value.features[0].attributes.PND_V5_Final_PU_TOT_BIZ));
		$('#pu-zip').text(results[0].value.features[0].attributes.PND_V5_Final_PU_ZIP_COUNT);	  
      	$('#org-zip').text($('#originationzip').val());	
      
      
    bufferLayer.setRenderer(renderer);

    StandardsResults = results[0].value.features;
    dojo.forEach(StandardsResults, function(feature){
		bufferLayer.add(feature); 
    });
 		addPinLabel5(origzip5);
      // zoom by getting the graphics for the buffer layer and setting it to the map extent
      map.setExtent(esri.graphicsExtent(bufferLayer.graphics), true); 	
	} else {
		uniqueValue = "origin_ENTRY_T_"+dojo.byId('form-service').value.toUpperCase()+"_NBR"
	var renderer = new esri.renderer.UniqueValueRenderer(defaultSymbol, uniqueValue);
    //add symbol for each possible value
    renderer.addValue("1", new esri.symbol.SimpleFillSymbol().setColor(new dojo.Color([168, 195, 221, 1.0])).setOutline(new esri.symbol.SimpleLineSymbol().setColor(new dojo.Color([118, 26, 18, 1.0])).setWidth(0)));
    renderer.addValue("2", new esri.symbol.SimpleFillSymbol().setColor(new dojo.Color([243, 161, 209, 1.0])).setOutline(new esri.symbol.SimpleLineSymbol().setColor(new dojo.Color([118, 26, 18, 1.0])).setWidth(0)));
    renderer.addValue("3", new esri.symbol.SimpleFillSymbol().setColor(new dojo.Color([245, 249, 165, 1.0])).setOutline(new esri.symbol.SimpleLineSymbol().setColor(new dojo.Color([118, 26, 18, 1.0])).setWidth(0)));
	
	// add new rederer value for each of the new colors - going up to 10 needs to be added
    renderer.addValue("4", new esri.symbol.SimpleFillSymbol().setColor(new dojo.Color([223, 188, 248, 1.0])).setOutline(new esri.symbol.SimpleLineSymbol().setColor(new dojo.Color([118, 26, 18, 1.0])).setWidth(0)));
    renderer.addValue("5", new esri.symbol.SimpleFillSymbol().setColor(new dojo.Color([241, 164, 101, 1.0])).setOutline(new esri.symbol.SimpleLineSymbol().setColor(new dojo.Color([118, 26, 18, 1.0])).setWidth(0)));
    renderer.addValue("6", new esri.symbol.SimpleFillSymbol().setColor(new dojo.Color([165, 159, 187, 1.0])).setOutline(new esri.symbol.SimpleLineSymbol().setColor(new dojo.Color([118, 26, 18, 1.0])).setWidth(0)));
    renderer.addValue("7", new esri.symbol.SimpleFillSymbol().setColor(new dojo.Color([124, 165, 190, 1.0])).setOutline(new esri.symbol.SimpleLineSymbol().setColor(new dojo.Color([118, 26, 18, 1.0])).setWidth(0)));
    renderer.addValue("8", new esri.symbol.SimpleFillSymbol().setColor(new dojo.Color([235, 200, 138, 1.0])).setOutline(new esri.symbol.SimpleLineSymbol().setColor(new dojo.Color([118, 26, 18, 1.0])).setWidth(0)));
    renderer.addValue("9", new esri.symbol.SimpleFillSymbol().setColor(new dojo.Color([155, 239, 180, 1.0])).setOutline(new esri.symbol.SimpleLineSymbol().setColor(new dojo.Color([118, 26, 18, 1.0])).setWidth(0)));
    renderer.addValue("10", new esri.symbol.SimpleFillSymbol().setColor(new dojo.Color([176, 116, 140, 1.0])).setOutline(new esri.symbol.SimpleLineSymbol().setColor(new dojo.Color([118, 26, 18, 1.0])).setWidth(0)));
    renderer.addValue("11", new esri.symbol.SimpleFillSymbol().setColor(new dojo.Color([153, 156, 115, 1.0])).setOutline(new esri.symbol.SimpleLineSymbol().setColor(new dojo.Color([118, 26, 18, 1.0])).setWidth(0)));
    renderer.addValue("12", new esri.symbol.SimpleFillSymbol().setColor(new dojo.Color([199, 165, 209, 1.0])).setOutline(new esri.symbol.SimpleLineSymbol().setColor(new dojo.Color([118, 26, 18, 1.0])).setWidth(0)));
    renderer.addValue("13", new esri.symbol.SimpleFillSymbol().setColor(new dojo.Color([159, 148, 239, 1.0])).setOutline(new esri.symbol.SimpleLineSymbol().setColor(new dojo.Color([118, 26, 18, 1.0])).setWidth(0)));
    renderer.addValue("14", new esri.symbol.SimpleFillSymbol().setColor(new dojo.Color([204, 211, 204, 1.0])).setOutline(new esri.symbol.SimpleLineSymbol().setColor(new dojo.Color([118, 26, 18, 1.0])).setWidth(0)));
    renderer.addValue("15", new esri.symbol.SimpleFillSymbol().setColor(new dojo.Color([171, 151, 145, 1.0])).setOutline(new esri.symbol.SimpleLineSymbol().setColor(new dojo.Color([118, 26, 18, 1.0])).setWidth(0)));
    renderer.addValue("16", new esri.symbol.SimpleFillSymbol().setColor(new dojo.Color([210, 248, 206, 1.0])).setOutline(new esri.symbol.SimpleLineSymbol().setColor(new dojo.Color([118, 26, 18, 1.0])).setWidth(0)));
    renderer.addValue("17", new esri.symbol.SimpleFillSymbol().setColor(new dojo.Color([235, 210, 188, 1.0])).setOutline(new esri.symbol.SimpleLineSymbol().setColor(new dojo.Color([118, 26, 18, 1.0])).setWidth(0)));
    renderer.addValue("18", new esri.symbol.SimpleFillSymbol().setColor(new dojo.Color([224, 222, 239, 1.0])).setOutline(new esri.symbol.SimpleLineSymbol().setColor(new dojo.Color([118, 26, 18, 1.0])).setWidth(0)));
    renderer.addValue("19", new esri.symbol.SimpleFillSymbol().setColor(new dojo.Color([208, 161, 161, 1.0])).setOutline(new esri.symbol.SimpleLineSymbol().setColor(new dojo.Color([118, 26, 18, 1.0])).setWidth(0)));
    renderer.addValue("20", new esri.symbol.SimpleFillSymbol().setColor(new dojo.Color([184, 199, 173, 1.0])).setOutline(new esri.symbol.SimpleLineSymbol().setColor(new dojo.Color([118, 26, 18, 1.0])).setWidth(0)));
    renderer.addValue("21", new esri.symbol.SimpleFillSymbol().setColor(new dojo.Color([239, 225, 157, 1.0])).setOutline(new esri.symbol.SimpleLineSymbol().setColor(new dojo.Color([118, 26, 18, 1.0])).setWidth(0)));
          bufferLayer.setRenderer(renderer);

    StandardsResults = results;
    dojo.forEach(StandardsResults, function(feature){
		var polygon = new esri.geometry.Polygon( {
          rings: feature.geometry.rings, // Use the rings from the geometry
          spatialReference: { wkid: 3857 }// Ensure the spatial reference matches the map

        });

		//var graphic = new esri.Graphic(polygon);
        var graphi = new esri.Graphic({
            geometry: polygon,
          	attributes: JSON.parse(JSON.stringify(feature.attributes))
        });

      
		bufferLayer.add(graphi); 
    });

		map.setZoom(1);
		addPinLabel(origzip3);  	
    
    }



  callLegend();
}


function errorHandler(err){
    console.log('Oops, error: ', err);
	esri.hide(dojo.byId("loadingImg"));
  	triggerError();
}


function createPrintButtonArea() {
	var divTag = document.createElement("div");
 	divTag.id = "print_buttonmap";
 	document.getElementById("print_button").appendChild(divTag);
	document.getElementById("print_buttonmap").className = "claro";	
}


function createmapLegendDiv(){
 	var divTag = document.createElement("div");
 	divTag.id = "mapLegend";
 	document.getElementById("mapDiv_root").appendChild(divTag);
}


function createLoadingImgDiv(){
 	var divTag = document.createElement("div");
	 divTag.id = "loadingImg";
 	document.getElementById("mapDiv_root").appendChild(divTag);
}

function createPrintableButtonArea() {
	var btn = document.createElement("button"); 
	var btntext = document.createTextNode("Printable Map");
	btn.setAttribute("type", "submit");
	btn.appendChild(btntext);
	btn.onclick = printablemap;
	document.getElementById('print_button').appendChild(btn);
	document.getElementById('print_button').className = "buttonprint";		
}


// ZIP 5
function addPinLabel5(origzip5) {
	var queryTask3 = new esri.tasks.QueryTask("https://ssmap.usps.com/arcgis/rest/services/ServiceStandards/USPS_ZIP5_Centroids_2/MapServer/0/");
	//build query
	//build query filter
   	var query3 = new esri.tasks.Query();
	query3.where = "ZIP = '" + origzip5 + "'";
   	query3.returnGeometry = true;
   	query3.outFields = ["ZIP"];
   	//execute query
   	queryTask3.execute(query3, addPinFeatureSetToMap, errorHandler);
}

/* ZIP 3 */

function addPinLabel(origzip3) {
	//build query
	var queryTask3 = new esri.tasks.QueryTask("https://ssmap.usps.com/arcgis/rest/services/ServiceStandards/ZIP3_Labels/MapServer/0");

	//build query filter
   	var query3 = new esri.tasks.Query();
	query3.where = "ZIP3 = '" + origzip3 + "'";
   	query3.returnGeometry = true;
   	query3.outFields = ["ZIP3"];
   	//execute query
   	queryTask3.execute(query3, addPinFeatureSetToMap, errorHandler);	
}


var testfeatureSet = null;



//adds pin image for the selected ZIP
function addPinFeatureSetToMap(featureSet) {
	var symbol =  new esri.symbol.PictureMarkerSymbol({  
  	//"url":"/priority-mail/map/Red-indicator.png",
  	"url":"/priority-mail/map/origination-icon.svg",
 	 "height":30,
  	 "width":24,
  	 "yoffset": 25
	});
	testfeatureSet = featureSet;
	var zipvalue;
	//Add pin to the graphics layer
	dojo.forEach(featureSet.features, function(feature) {
		if (dojo.byId('form-service').value == 'PND'){
			zipvalue = feature.attributes.ZIP;
		} else {
			zipvalue = feature.attributes.ZIP3;
		}
		pinLayer.add(feature.setSymbol(symbol));
      	map.setExtent(esri.graphicsExtent(pinLayer.graphics), true);

	});
}



// removes the map with blue color
function removeBlueColor() {
	map.removeLayer(map.getLayer(map.layerIds[1]));
	map.addLayer(bufferLayer,1);
	map.addLayer(pinLayer, 2);
}

//call the printable page
function printablemap(){
	
	var ZIPS = "ZIPS"
	if (origzip3 === undefined) {
    	var URL = "/priority-mail/map/map_print.html?zoomlevel="+currentZoom+"&ZIP="+ZIPS;
	} else {
   		var URL = "/priority-mail/map/map_print.html?zoomlevel="+currentZoom+"&ZIP="+origzip3;
	} 

	var win = window.open(URL, "map_print", 'width=915, height=800, scrollbars=yes,menubar=yes');
}
dojo.addOnLoad(init);