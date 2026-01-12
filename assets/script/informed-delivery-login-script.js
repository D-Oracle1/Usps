pingenvlogin = "https://informeddelivery.usps.com/portal/dashboard?mode=id-login";
var mobilesign = '<a href="'+pingenvlogin+'">Sign In</a>';



	if (document.querySelector('#nav-utility #nav-tool-login') == null) {
		document.getElementById('login-register-header').href=pingenvlogin;
		document.querySelector('.mobile-sign').innerHTML = mobilesign;
	
	}
	