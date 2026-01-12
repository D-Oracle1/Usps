// 250th JS
const duration = 5000; //5 sec
const transitionDur = 500 //1/2 sec
$(document).ready(()=>{
    // Start animation loop
    setTimeout(LoopFadeToRandom, duration);

    // Start listening for users returning to the page
    setTimeout(()=>{
        $(document).on("visibilitychange", () => {
            if(!document.hidden){
                setTimeout(1);
                let itemList = $("[data-carousel-option]");
                if(itemList.length>1){
                    itemList.hide();
                    $(itemList[Math.floor(Math.random()*(itemList.length))]).show();
                }
            }   
        })
    }, duration);
});

function LoopFadeToRandom(){
    let itemList = $("[data-carousel-option]:not(:visible)");
    let next = itemList[Math.floor(Math.random()*(itemList.length))];
    let current = $("[data-carousel-option]:visible, [data-carousel-default]:visible");
    if(!current){
        $(next).fadeIn(0);
    }else{
        current.fadeOut(transitionDur, ()=>{
            setTimeout(1);
            $("[data-carousel-option]").hide();
            $(next).fadeIn(transitionDur);
        });
    }
    setTimeout(LoopFadeToRandom, duration);
}