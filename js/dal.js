var map= null;
var korttype= 'Danmark';
var geojsonlayer= null;
var senestesekvensnummer= 0;
var antal= 0;
var host= "https://api.dataforsyningen.dk";
var valgtadresse=null;

$(function() {

  var info= $("#adresseinfo");
  info.html( "" );
  info.listview();

  $.ajax({
      url: host+"/replikering/senestesekvensnummer"
      ,dataType: "jsonp"
  })
  .then( function ( seneste ) {
    senestesekvensnummer= seneste.sekvensnummer;
    hentliste(senestesekvensnummer-100,senestesekvensnummer);
  });

  map = L.map('map',{zoom: 13});
  var osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {attribution: 'Map data &copy; OpenStreetMap contributors'});
  osm.addTo(map);
  map.fitBounds([
    [57.751949, 15.193240],
    [54.559132, 8.074720]
  ]);
  map._onResize(); 

  $('#kortbtn').on("click", function() {
    korttype= 'Danmark';
  });
 
  function danTidspunkt(adresse) {
    var tidspunkt= moment(adresse.historik.ændret);
    return tidspunkt.locale('da').format('LLL');
  }
  
  function danKommune(adresse) {
    return (adresse.adgangsadresse.kommune?adresse.adgangsadresse.kommune.kode+' '+adresse.adgangsadresse.kommune.navn:"");
  }
  
  function danAdresse(adresse) {
    return adresse.adgangsadresse.vejstykke.navn + (adresse.adgangsadresse.husnr.length > 0?' '+adresse.adgangsadresse.husnr:"")  + (adresse.etage?', '+adresse.etage+'.':"") + (adresse.dør?' '+adresse.dør:"")+ "<br />" +(adresse.adgangsadresse.supplerendebynavn?' '+adresse.adgangsadresse.supplerendebynavn+"<br />":"") +  (adresse.adgangsadresse.postnummer?adresse.adgangsadresse.postnummer.nr+' '+adresse.adgangsadresse.postnummer.navn:"");
  }

  function visAdresseInfo(adresse) { 
    info.prepend("<li id='" + adresse.id + "'><a href='#kort'><p><i>"+ danKommune(adresse) + " - " + danTidspunkt(adresse) + "</i><br/><strong>" + danAdresse(adresse) + "</strong></p></a></li>");
    $('#' + adresse.id).on("click", adresse, function() {
      korttype= null;
      valgtadresse= adresse;
    });
    var aa= adresse.adgangsadresse; 
    if (aa.adgangspunkt.koordinater) {
      var marker= L.circleMarker(new L.LatLng(aa.adgangspunkt.koordinater[1], aa.adgangspunkt.koordinater[0]), {color: 'red', fillColor: 'red', stroke: false, fillOpacity: 1.0, radius: 5}).addTo(map);
      //var marker= L.marker(new L.LatLng(aa.adgangspunkt.koordinater[1], aa.adgangspunkt.koordinater[0])).addTo(map);   
      marker.bindPopup("<i>" + danKommune(adresse) + " - " + danTidspunkt(adresse) + "</i><br/><strong>" + danAdresse(adresse) + "</strong>");//.openPopup();
      map._onResize(); 
    }
    antal++;
  } 

  function iterator(hændelse, callback) {
    $.ajax({
        url: host+"/adresser/"+hændelse.data.id
        //,dataType: "jsonp"
    })
    .then( function ( adresse ) {  
      callback(null,adresse); 
    })
    .fail( function (XHR, status, error) { 
      callback(null,null); 
    });
  };


  function finish(err, adresser) {
    adresser= adresser.filter(function(adresse) {return adresse !== null;});
    adresser= adresser.sort(compare); 
    $.each( adresser, function ( i, adresse ) {
      visAdresseInfo(adresse);
    });     
    info.listview( "refresh" ); 
    map._onResize();      
  }

  function compare(a, b) {
    if (!a.historik || !a.historik.ændret) console.log("Uden ændret: "+a.href);
    if (!b.historik || !b.historik.ændret) console.log("Uden ændret: "+b.href);
    if (a.historik.ændret < b.historik.ændret)
       return -1;
    if (a.historik.ændret > b.historik.ændret)
       return 1;
    return 0;
  }

  function hentliste(fra, til) {    
    var parametre=  {};
    parametre.sekvensnummerfra= fra;
    parametre.sekvensnummertil= til;
    $.ajax({
        url: host+"/replikering/adresser/haendelser",
        dataType: "jsonp",
        data: parametre
    })
    .then( function ( hændelser ) { 
      hændelser= hændelser.filter(function(hændelse) {return hændelse.operation === 'insert';}); 
      if (hændelser.length > 0) { 
        async.map(hændelser, iterator, finish); 
        setInterval(function () {
          $.ajax({url: host+"/replikering/senestesekvensnummer", dataType: "jsonp"})
          .then( function ( seneste ) {
            if (seneste.sekvensnummer > senestesekvensnummer) { 
              var snr= senestesekvensnummer+1;            
              senestesekvensnummer= seneste.sekvensnummer;
              henthændelser(snr,seneste.sekvensnummer); 
            }
          });
        }, 60000);
      }  
      else {      
        fra= fra-100;
        til= til-100;
        hentliste(fra,til);
      }
    });
  }

  function henthændelser(fra,til) {
    var parametre= {};
    parametre.sekvensnummerfra= fra;
    parametre.sekvensnummertil= til;
    $.ajax({
        url: host+"/replikering/adresser/haendelser",
        dataType: "jsonp",
        data: parametre
    })
    .then( function ( hændelser ) { 
      hændelser= hændelser.filter(function(hændelse) {return hændelse.operation === 'insert';}); 
      if (hændelser.length > 0) { 
        async.map(hændelser, iterator, finish); 
      }
    });
  }

  function initialiseret() {
    return antal > 0;
  }

  $( "#kort" ).pagecontainer({
  load: function( event, ui ) {

  }
});

  $(document).on('pageshow', '#kort', function(event, ui) {
    if (korttype === 'Danmark') {
     map.fitBounds([
        [57.751949, 15.193240],
        [54.559132, 8.074720]
      ]);
      korttype= null;
      map._onResize(); 
    }
    else {      
      var aa= valgtadresse.adgangsadresse;      
      if (aa.adgangspunkt.koordinater) {
        map.setView(new L.LatLng(aa.adgangspunkt.koordinater[1], aa.adgangspunkt.koordinater[0]),16);        
        map._onResize(); 
      }
      else {
        alert('Adressen har ingen koordinater');
      }
    }
  });
  
});





