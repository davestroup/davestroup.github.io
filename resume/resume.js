document.querySelectorAll('[data-email]').forEach(link=>{
  const email=['dave.stroup','gmail.com'].join('@');
  link.href=`mailto:${email}`;link.textContent=email;
});
const printButton=document.querySelector('.print-button');
printButton.hidden=false;
printButton.addEventListener('click',async()=>{await document.fonts.ready;window.print();});
