	var resizeTimer;
	$(window).on('load resize', function(e) {
	  clearTimeout(resizeTimer);
	  resizeTimer = setTimeout(function() {
		// Run code here, resizing has "stopped"
		if($(window).width()>=767){
			$('.v-tab div.active').removeClass('active');
			$('.v-tab-content div.active').removeClass('active');
			$('.v-tab div').eq(0).addClass('active');
			$('.v-tab-content div').eq($('.v-tab div.active').index()).addClass('active');
			$('.v-tab .mobile-content').remove('.mobile-content');
		} else if ($(window).width()<767) {
			$('.v-tab div.active').removeClass('active');
			$('.v-tab-content div.active').removeClass('active');
			$('.v-tab .mobile-content').remove('.mobile-content');
		}	
	  }, 250);
	});
	$('.v-tab div a').on('click touch', function(e){
		console.log('Clicked on v-tab');
		e.preventDefault();
		if($(window).width()>=767){
			$('.v-tab div.active').removeClass('active');
			$('.v-tab-content div.active').removeClass('active');
			$('.v-tab .mobile-content').remove('.mobile-content');
			$(this).parent().addClass('active');
			$('.v-tab-content div').eq($('.v-tab div.active').index()).addClass('active');
			console.log('Window Width >=797');
			$('html, body').animate({scrollTop: $('.v-tab-content div').eq($('.v-tab div.active').index()).offset().top}, 500);
		} else if ($(window).width()<767) {
			if ($(this).parent().hasClass('active')){
				$(this).parent().removeClass('active');
				$('.v-tab-content div.active').removeClass('active');
				$('.v-tab .mobile-content').remove('.mobile-content');
				$('html, body').animate({scrollTop: $(this).parent().offset().top}, 500);
			} else {
				$('.v-tab div.active').removeClass('active');
				$('.v-tab-content div.active').removeClass('active');
				$(this).parent().addClass('active');
				$('.v-tab-content div').eq($('.v-tab div.active').index()).addClass('active');	
				$('.v-tab .mobile-content').remove('.mobile-content');
				activeContent = '<div class="mobile-content">'+$('.v-tab-content .active').html()+'</div>';
				$('.v-tab .active').append(activeContent);
				$('html, body').animate({scrollTop: $(this).parent().offset().top}, 500);

			}
		}
	});
	$('.faq-unit h4').on('click touch', function(e){
		console.log('Clicked on faq');
		e.preventDefault();
		$(this).parent().toggleClass('active');
	});
	$('.lg-crd h3').on('click touch', function(e){
		console.log('Clicked on faq');
		e.preventDefault();
		$(this).parent().parent().toggleClass('active');
	});
$('span.expand').on('click touch', function(e){
	$this = $(this);
	$this.toggleClass('active');
	if ($this.hasClass('active')){
		$this.text('Hide All');
		$this.parents('.faq-section, .lg-txt-crd').find('.lg-crd, .faq-unit').addClass('active');
	}else{
		$this.text('Expand All');
		$this.parents('.faq-section, .lg-txt-crd').find('.lg-crd, .faq-unit').removeClass('active');
	}
});