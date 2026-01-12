var USPS = {};

USPS.PMmap = (function() {
    
    var 
        elements = {};
    
    var init = function init() {

        elements.form = dojo.byId('mapform');
                
        dojo.connect(
            elements.form,
            'onsubmit',
            validateForm
        );
    };

    var validateForm = function validateForm(e) {
        if (typeof(event) === 'undefined') {
            e.preventDefault();
        } else{
            (event.preventDefault) ? e.preventDefault() : event.returnValue = false;
        }
        
        elements.origin = dojo.byId('originationzip');

        var numbersOnly      = /^[\d]*$/,
            originValue      = elements.origin.value,
            errors           = dojo.query('#errors ul')[0],
            inputSectionWrap = dojo.query('.delivery-map')[0],
            errorList        = [];
        
        dojo.removeClass(inputSectionWrap, 'error');
        dojo.empty(errors);

/*
      if( originValue === '' || !numbersOnly.test(originValue) || (originValue.length < 5) ) {
		//$('#error-zip p').text('Please enter a valid 5-digit ZIP Code™.');
		$('#error-zip').show();
		$('#originationzip').addClass('error');        
      } else {
            displaymap(dojo.byId('originationzip').value,dojo.byId('form-service').value);
            dojo.byId('originationzip').blur();
            dojo.byId("originationzip").scrollIntoView();
        }*/
		if (dojo.byId('form-service').value == '') {
				$('#error-service').show();
				$('#form-service').addClass('error');   

		} else {
				$('#error-service').hide();
				$('#form-service.error').removeClass('error');   			
		}
		if( originValue === '' || !numbersOnly.test(originValue) || (originValue.length < 5) ) {
			//$('#error-zip p').text('Please enter a valid 5-digit ZIP Code™.');
			$('#error-zip').show();
			$('#originationzip').addClass('error'); 

		} else {
			$('#error-zip').hide();
			$('#originationzip.error').removeClass('error');   
		}
		if ($('.error:visible').length > 0){
			$('html, body').animate({
				scrollTop: $('.error:visible:first').offset().top
			}, 500);
			
		} else {
			$('#error-zip').hide();
			$('#error-service').hide();
			$('.form-wrapper .error').removeClass('error')
            displaymap(dojo.byId('originationzip').value,dojo.byId('form-service').value);
            dojo.byId('originationzip').blur();
            dojo.byId("mapDiv").scrollIntoView();
        }
        
        
    };
    
    return {
        start : init
    }
})();

dojo.addOnLoad(function() {
    USPS.PMmap.start();
});