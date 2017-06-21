window.Checkout = {};
$( '#tos' ).on( 'click', function() {
  $( '#tosModal' ).modal();
  $.get( "/tos", function( html ) {
    $( ".modal-body" ).html( html );
  } );
} );

//window.addEventListener( "", function( e ) {
var allowedCities = [
  "Palo Alto", "San Mateo", "Alameda", "Oakland", "Berkeley", "Emeryville",
  "Santa Clara", "Atherton", "Belmont", "Brisbane", "Burlingame",
  "Colma", "Daly City", "El Granada", "Foster City", "Hillsborough",
  "Half Moon Bay", "La Honda", "Los Altos", "Menlo Park", "Millbrae",
  "Mountain View", "Pacifica", "Portola Valley", "Redwood City", "San Bruno",
  "San Carlos", "South San Francisco", "Woodside", "San Francisco",
  "San Jose"
];

$( document ).ready( function() {

  //Set up right view for mobile or desktop
  if ( $( window ).width() >= 991 ) {
    $( '#orderSummary' ).addClass( 'in' );
  }


  //Save Cart to mailchimp
  $( "input[name='customer[email]']" ).on( "change", function() {
    if ( $( "input[name='customer[email]']" ).val() !== "" ) {
      email = $( "input[name='customer[email]']" ).val();
      cartInfo.customer = {
        email: email,
        opt_in_status: false
      }
      $.ajax( {
          method: "POST",
          url: "/addCart",
          data: cartInfo
        } )
        .done( function( msg ) {
          // console.log( msg );
          Rollbar.configure( {
            payload: {
              person: {
                id: email,
                username: email,
                email: email
              }
            }
          } );
        } );
    }
  } )

  Checkout.buildForm( cartId );

  // Global Shipping
  if ( getCookie( "isShippingGlobal" ) !== "" ) {
    $( ".field_static_city" ).addClass( "hidden" );
    $( "#field_city" ).removeAttr( "readonly" );
    $( "#field_city" ).removeClass( "hidden" );
    $( "#field_state" ).removeAttr( "readonly" );
    $( "#field_state" ).removeClass( "hidden" );
    $( "#shipping-method" ).removeClass( "hidden" );
  }
  var card_number = $( "input[name='payment[card][number]']" );
  $( '[data-numeric]' ).payment( 'restrictNumeric' );
  $( card_number ).payment( 'formatCardNumber' );
  $( "input[name='payment[card][expires]']" ).payment( 'formatCardExpiry' );
  $( "input[name='payment[card][cvc]']" ).payment( 'formatCardCVC' );

  $( card_number ).keyup( function() {
    if ( $( card_number ).val().length > 1 ) {
      var cardType = $.payment.cardType( $( card_number ).val() );
      if ( cardType !== null ) {
        $( '.cc-brand' ).html( "<i class='fa fa-cc-" + cardType + "' aria-hidden='true'></i> " );
      }
    } else {
      $( '.cc-brand' ).html( "" );
    }

  } );
} );





/********* CHECKOUT METHODS *********/
Checkout.buildForm = function( cartID ) {
  CommercejsSpace.Checkout.generateToken( cartID, {
      type: "cart"
    }, function( resp ) {
      window.cartInfo = resp;
      //Store the checkout token id as a global variable
      window.checkout_token_id = resp.id;
      var products = resp.live.line_items;
      window.live = resp.live;
      var extrafields = resp.extrafields;
      // Get State list
      Checkout.shippingCountrySubdivisions( "US", "" );

      // Get Location in order to set tax rate
      CommercejsSpace.Checkout.getLocationFromIP( checkout_token_id, function( resp ) {
          //Success
          var ip_address = resp.ip_address;
          CommercejsSpace.Checkout.setTaxZone( checkout_token_id, {
              'ip_address': ip_address
            },
            function( resp ) {
              Checkout.updateTotal( resp.live );
            },
            function( error ) {
              //Error handler
              Rollbar.critical( "Chec.io: " + error.error.message, {
                error: error
              } );
            }
          );
        },
        function( error ) {
          //Error handler
          Rollbar.critical( "Chec.io: " + error.error.message, {
            error: error
          } );
        }
      );

      for ( var i = 0; i < products.length; i++ ) {
        if(products[i].product_id === "prod_4OANwRLdk5vYL8") {
          products[i].is_fiddle = true;
        }
      }

      // Generate order summary
      Checkout.generateOrderSummary( products );

      // Need to create  a method for extrafields
      var extrafields_ = resp.extrafields;
      $.each( extrafields_, function( k, extrafield ) {

        switch ( extrafield.name ) {
          case "Your Gift Message":
            extrafields_[ k ].order = 1;
            extrafields_[ k ].group = "gift";
            break;
          case "Delivery Date":
            extrafields_[ k ].order = 2;
            extrafields_[ k ].group = "none";
            break;
          case "Preferred Delivery Time":
            extrafields_[ k ].order = 3;
            extrafields_[ k ].group = "none";
            break;
          case "This is a Gift":
            extrafields_[ k ].order = 0;
            extrafields_[ k ].group = "gift";
            break;
          default:
            extrafields_[ k ].order = 10;
            extrafields_[ k ].group = "none";
        }
      } );


      extrafields_.sort( compare );

      function compare( a, b ) {
        if ( a.order < b.order )
          return -1;
        if ( a.order > b.order )
          return 1;
        return 0;
      }

      var currentDate = new Date();
      var dayPlus = 2,
        unavailableDates = [ 1, 2, 4, 6 ],
        titleDatePicker = 'Available delivery dates are Wednesdays, Fridays and Sundays (unless already filled up)';

      if ( currentDate.getHours() >= 11 && currentDate.getDay() === 5 ) {
        dayPlus = 3
      } else {
        dayPlus = 2
      }

      if((currentDate.getDay() === 5 || currentDate.getDay() === 6) ) {
        for ( var i = 0; i < products.length; i++ ) {
          if(products[i].product_id == "prod_yA6nld7Ka5EWbz") {
            dayPlus = 1;
          }
        }
      }

      var minDate = ( currentDate.getMonth() + 1 ) + " / " +
        ( currentDate.getDate() + dayPlus ) +
        " / " +
        currentDate.getUTCFullYear();

      $( "#extrafieldsTarget" ).html( '' );

      $.each( extrafields_, function( k, extrafield ) {

        var cssClass = 'form-control';
        var type = extrafield.type;
        var id = extrafield.id;

        var name = extrafield.name;
        var extraInfo = "";
        var fieldValidation = "";
        if ( extrafield.required ) {
          extraInfo = "";
          fieldValidation = "required";
        } else if ( extrafield.id === "extr_6ZRjywMa4w7Y8G" ) {
          extraInfo += "";
        } else {
          extraInfo += " (Optional)";
        }
        var visibilityComp
        if ( extrafield.group === "gift" ) {
          visibilityComp = "hidden extrafield-class";
        }

        if ( extrafield.type === "date" ) {
          type = "text";
          div_id = "date_delivery";
          visibilityComp = "hidden date_delivery"
        } else if ( extrafield.type === "checkbox" ) {
          cssClass = "";
          visibilityComp = "show";
          id = "giftToggle";
        } else if ( extrafield.name === "Preferred Delivery Time" ) {
          visibilityComp = "hidden preferred_delivery_time"
        }

        var option_html = "";
        if ( extrafield.type === "checkbox" ) {
          option_html += "<div class='checkbox'><label>";
          option_html += "<input class='" + cssClass + "' type='" + type + "' name='extrafields[" + name + "]' id='" + id + "'> ";
          option_html += extrafield.name + "</label></div>";
        } else if ( extrafield.type === "options" ) {
          option_html += "<div class='form-group " + visibilityComp + "'><div class='col-md-12'>";
          option_html += "<select class='" + cssClass + "' name='extrafields[" + id + "]' id='" + id + "'><option disabled selected value='Anytime'>Preferred Delivery Time (Optional)</option>";
          for ( var i = 0; i < extrafield.options.length; i++ ) {
            option_html += "<option>" + extrafield.options[ i ] + "</option>";
          }
          option_html += "</select></div></div>";
        } else if ( extrafield.type === "date" ) {
          option_html = "<div class='form-group " + visibilityComp + "'><div class='col-md-12'>";
          option_html += "<input class='" + cssClass + "'  type='" + type + "' name='extrafields[" + id + "]' id='" + div_id + "' placeholder='" + extrafield.name + extraInfo + "' readonly> ";
          option_html += "</div></div>";
        } else if ( extrafield.type === "hidden" ) {
          var valueField = getCookie( extrafield.name );
          option_html += "<input class='" + cssClass + "' type='" + type + "' value='" + valueField + "' name='extrafields[" + id + "]' id='" + id + "' placeholder='" + extrafield.name + extraInfo + "'> ";
        } else {
          option_html = "<div class='form-group " + visibilityComp + "'><div class='col-md-12'>";
          if ( extrafield.name === "Delivery Instructions" || extrafield.name === "Your Gift Message" ) {
            option_html += "<textarea class='" + cssClass + "' type='" + type + "' name='extrafields[" + id + "]' id='" + id + "' placeholder='" + extrafield.name + extraInfo + ( extrafield.name == 'Your Gift Message' ? '\nRemember to include your name if you want the recipient to know who sent it!' : '' ) + "' " + ( extrafield.name == 'Your Gift Message' ? 'style=\'margin-bottom: 20px;\'' : '' ) + "></textarea>";
          } else {
            var valueField = "";
            option_html += "<input class='" + cssClass + "' type='" + type + "' value='" + valueField + "' name='extrafields[" + id + "]' id='" + id + "' placeholder='" + ( extrafield.name == 'Phone Number' ? 'Recipient ' + extrafield.name : extrafield.name ) + extraInfo + "'> ";
          }
          option_html += "</div></div>";
        }
        $( "#extrafieldsTarget" ).append( option_html );
      } );
      $( "#date_delivery" ).datepicker( {
        startDate: minDate,
        autoclose: true,
        daysOfWeekDisabled: unavailableDates,
        title: titleDatePicker,
        todayHighlight: true
      } );
      //End of extrafields


      // toggle for gift
      $( "#giftToggle" ).on( "change", function() {
        if ( this.checked ) {
          $( ".extrafield-class" ).removeClass( "hidden" );
        } else {
          $( ".extrafield-class" ).addClass( "hidden" );
        }
      } );

      //Loop through each shipping option
      $.each( resp.shipping_methods, function( k, method ) {
        //Create an <option> for the method
        var option_html = "<option value=\"" + method.id + "\">" + method.description + " + " + method.price.formatted_with_symbol + "</option>";
        //Append the new option to the shipping option <select>
        $( 'select[name="fulfillment[shipping_method]"]' ).append( option_html );
        $( 'select[name="fulfillment[shipping_method]"]' ).val( "ship_7ZAMo1JRM5NJ4x" );

      } );

      var gateway_html = "";
      $.each( resp.gateways.available, function( k, gateway ) {
        if ( gateway === true ) {
          if ( location.hostname === "localhost" || location.hostname === "forestical-dev.herokuapp.com" || location.hostname === "forestical-staging.herokuapp.com" ) {
            k = "test_gateway";
          }
          gateway_html += "<label class='radio-inline'>" +
            "<input type='radio' name='payment[gateway]' checked value='" + k + "'> " + k +
            "</label>"
        }
      } );
      $( "#gateway_options" ).html( gateway_html );
      //Let's use the List all countries helper to populate the shipping[country] <select> with countries
      CommercejsSpace.Services.localeListCountries( function( resp ) {
        $( 'select[name="shipping[country]"]' ).html( resp.html );

        //Pre select USA
        $( 'select[name="shipping[country]"] option[value="US"]' ).prop( 'selected', true );
        // Temporary hack until we get categories in cart and live object
        var usaProducts = [ "prod_mOVKl4Y98wprRP", "prod_O3bR5XExQlnzdj", "prod_zkK6oLpVeoXn0Q", "prod_RqEv5xYQklZz4j" ];
        for ( var i = 0; i < products.length; i++ ) {
          if ( !usaProducts.includes( products[ i ].product_id ) ) {
            $( ".date_delivery" ).removeClass( "hidden" );

            $( ".delivery-mention" ).html( "Delivery<small>Delivery to San Francisco and <a href=\"javascript:;\" data-toggle=\"tooltip\" data-placement=\"bottom\" class=\"delivery-tooltip\">surrounding cities <i class=\"fa fa-info-circle\" aria-hidden=\"true\"></i></a> only<br>Available on Wednesdays, Fridays and Sundays</small>" );
            activateDeliveryBootstrapTooltips();

            // Warn User and force SF only
            if ( parseInt( cartInfo.live.total_with_tax.raw ) < 499 ) {
              $( 'input[name="shipping[town_city]"]' ).val( "San Francisco" );
              $( 'input[name="shipping[town_city]"]' ).attr( "readonly", "readonly" );
            } else {
              new autoComplete( {
                selector: 'input[name="shipping[town_city]"]',
                minChars: 2,
                source: function( term, suggest ) {
                  term = term.toLowerCase();
                  var choices = allowedCities;
                  var matches = [];
                  for ( i = 0; i < choices.length; i++ )
                    if ( ~choices[ i ].toLowerCase().indexOf( term ) ) matches.push( choices[ i ] );
                  suggest( matches );
                },
                onSelect: function( e, term, item ) {}
              } );

              $( 'input[name="shipping[town_city]"]' ).on( "blur", function() {
                var curCity = $( 'input[name="shipping[town_city]"]' ).val()
                if ( !allowedCities.includes( curCity ) ) {
                  $( 'input[name="shipping[town_city]"]' ).val( "" );
                }
              } );

              // $( 'input[name="shipping[town_city]"]' ).attr( "readonly", "readonly" );
            }

            $( "#date_delivery" ).attr( "required", true );
            $( ".preferred_delivery_time" ).removeClass( "hidden" ); // Time
            var attemptCount = 0;
            ( function foo() {
              if ( $( 'select[name="shipping[county_state]"]' ).find( "option" ).length > 0 ) {
                $( 'select[name="shipping[county_state]"]' ).find( 'option[value="CA"]' ).prop( 'selected', true );
                $( 'select[name="shipping[county_state]"]' ).attr( "readonly", "readonly" );
                $( 'select[name="shipping[county_state]"]' ).each( function() {
                  $( "<input type='text' />" ).attr( {
                    name: this.name,
                    value: this.value,
                    readonly: "readonly",
                    class: "form-control"
                  } ).insertBefore( this );
                } ).remove();
              } else if ( $( 'input[name="shipping[county_state]"]' ).val() === "CA" ) {
                // all good
              } else {
                attemptCount++;
                if ( attemptCount < 51 ) {
                  setTimeout( function() {
                    foo();
                  }, 500 );
                } else {
                  Rollbar.critical( "Tried 50 times, Can't set up Read only" );
                  console.log( "Something really wrong" );
                }
              }
            } )();
          }
        }
      } );
    },
    function( error ) {
      Rollbar.info( "Chec.io: " + error.error.message, {
        error: error
      }, function( err, data ) {
        if ( err ) {
          console.log( "Error while reporting error to Rollbar: ", e );
        } else {
          window.location = "/";
        }
      } );
    }
  );
}

Checkout.checkShippingOption = function( id ) {
  return CommercejsSpace.Checkout.checkShippingOption( checkout_token_id, {
    'country': $( 'select[name=\'shipping[country]\']' ).val(),
    'region': $( 'select[name=\'shipping[county_state]\']' ).val(),
    'id': id
  }, function( resp ) {
    if ( resp.valid === true ) {
      return Checkout.updateTotal( resp.live );
    } else {
      alert( 'This shipping method is not available' );
      return Checkout.updateTotal( resp.live );
    }
  } );
};


Checkout.applyDiscount = function( btn, discountField ) {
  $( btn ).button( 'loading' );
  var code = $( discountField ).val();
  code = code.toUpperCase().trim();
  $( discountField ).val( code );
  $( ".discountResp" ).remove();


  CommercejsSpace.Checkout.checkDiscount( checkout_token_id, {
      code: code
    }, function( resp ) {
      //Success
      // Update display
      if ( resp.valid ) {
        Checkout.updateTotal( resp.live );
        $( btn ).button( "complete" );
        $( btn ).after( "<div class='discountResp text-success'><strong>Discount code has been applied to your total below!</strong></div>" );
      } else {
        $( btn ).button( "reset" );
        $( btn ).after( "<div class='discountResp text-warning'><strong>Discount code is invalid!</strong></div>" );
        $( discountField ).val( "" );
      }
    },
    function( error ) {

    }
  );
}
Checkout.generateOrderSummary = function( products ) {
  var template = $( '#productTmpl' ).html();
  Mustache.parse( template );
  var rendered = Mustache.render( template, {
    products: products,
    lower: function() {
      return function( text, render ) {
        return render( text ).replace( /\s+/g, '-' ).toLowerCase();
      }
    }
  } );
  $( '#productListTarget' ).html( rendered );
}
Checkout.updateQuantity = function( id, amount ) {
  if ( amount < 1 ) {
    alert( "Requested quantity needs to be 1 or greater." );
  } else {
    var post;
    post = {
      amount: amount
    };
    return CommercejsSpace.Checkout.checkQuantity( checkout_token_id, id, post, function( data ) {
      Checkout.generateOrderSummary( data.live.line_items );
      Checkout.updateTotal( data.live );
      return true;
    } );
  }
}

Checkout.updateTotal = function( dataLive ) {
  var templateInv = $( '#totalInvoiceTmpl' ).html();
  Mustache.parse( templateInv );
  var renderedInv = Mustache.render( templateInv, {
    live: dataLive
  } );
  $( '#totalInvoiceTarget' ).html( renderedInv );

  var templateInv = $( '#orderSumTmpl' ).html();
  Mustache.parse( templateInv );
  var renderedInv = Mustache.render( templateInv, {
    live: dataLive
  } );
  $( '.order-bar-for-mobile' ).html( renderedInv );
}
Checkout.SubmitOrder = function( initZ ) {
  $( 'input' ).parent( "div" ).removeClass( "has-error" );
  window.initZ = initZ;

  $( '.formErrorNotification' ).remove();
  $( '.help-block' ).remove();
  $( initZ ).button( 'loading' );
  // Create Stripe Token needed for completing transaction
  Stripe.card.createToken( $( '#checkout' ), function( status, response ) {
    // Reconstruct full address from 2 fields
    var inputStreetA = $( "input[name='shipping[streetA]']" ).val();
    var inputStreetB = $( "input[name='shipping[streetB]']" ).val();
    var inputStreet = $( "input[name='shipping[street]']" );
    if ( $( "input[name='shipping[streetB]']" ).val() !== "" ) {
      $( inputStreet ).val( inputStreetA + " " + inputStreetB );
    } else {
      $( inputStreet ).val( inputStreetA );
    }

    // Get First and Lastname from merged field
    var inputFLname = $( "input[name='customer[firstlastname]']" );
    var inputFisrtname = $( "input[name='customer[firstname]']" );
    var inputLastname = $( "input[name='customer[lastname]']" );
    var res = $( inputFLname ).val().trim().split( " " );
    if ( res.length > 2 ) {
      $( inputFisrtname ).val( res[ 0 ] + " " + res[ 1 ] );
      $( inputLastname ).val( res[ 2 ] );
    } else {
      $( inputFisrtname ).val( res[ 0 ] );
      $( inputLastname ).val( res[ 1 ] );
    }

    // Grab the form:
    var $form = $( '#checkout' );
    if ( response.error ) { // Problem!
      Rollbar.critical( "Stripe: " + response.error.message, {
        checkoutID: checkout_token_id
      } );
      $( initZ ).after( "<p class='formErrorNotification bg-danger'>" + response.error.message + "</p>" );
      $( initZ ).button( 'reset' );
      switch ( response.error.param ) {
        case "exp_year":
          response.error.param = "exp";
          break;
        case "exp_month":
          response.error.param = "exp";
      }

      $( 'input[data-stripe=\"' + response.error.param + '\"]' ).parent( "div" ).addClass( "has-error" );
      $( 'input[data-stripe=\"' + response.error.param + '\"]' ).after( "<p class='help-block'>" + response.error.message + "</p>" );
    } else { // Token was created!
      // Get the token ID:
      var token = response.id;

      // Insert the token ID into the form so it gets submitted to the server:
      $form.append( $( '<input type="hidden" name="payment[card][token]">' ).val( token ) );
      $form.append( $( '<input type="hidden" name="stripeToken">' ).val( token ) );
      var order = $( '#checkout' ).serializeJSON();
      CommercejsSpace.Checkout.capture( checkout_token_id, order,
        function( resp ) {
          window.orderInfo = resp;
          if ( order.isOptedIn === "on" ) {
            order.isOptedIn = true;
          } else {
            order.isOptedIn = false;
          }
          // console.log( order );
          $.redirect( "/thanks", {
            order_id: orderInfo.id,
            isOptedIn: order.isOptedIn
          }, "POST" );
        },
        function( error ) {
          Checkout.displayErrors( error );
        }
      );
    }
  } );
}


Checkout.goToPayment = function() {
  $( ".help-block" ).remove();
  $( ".has-error" ).removeClass( "has-error" );
  // Soft Validation
  var errorCount = 0;
  $.each( $( "#delivery-section" ).find( "input[type='text'], input[type='email']" ), function( k, field ) {
    if ( $( field ).attr( "required" ) === "required" && $( field ).val() === "" ) {
      errorCount++;
      $( field ).parent( "div" ).addClass( "has-error" );
      $( field ).after( "<p class='help-block'>This field is required</p>" );
    }
  } );
  if ( errorCount === 0 ) {
    $( "#delivery-section" ).addClass( "hide" );
    $( "#payment-section" ).removeClass( "hide" );
    $( ".step1" ).removeClass( "active-section" );
    $( ".step2" ).addClass( "active-section" );
    if ( typeof mixpanel !== "undefined" ) {
      mixpanel.track( "Checkout - Step to Payment" );
    }
    $( 'html,body' ).scrollTop( $( '.checkout-header' ).offset().top + 10 );
  }

}

Checkout.goToDelivery = function() {
  $( "#payment-section" ).addClass( "hide" );
  $( "#delivery-section" ).removeClass( "hide" );
  $( ".step1" ).addClass( "active-section" );
  $( ".step2" ).removeClass( "active-section" );
  if ( typeof mixpanel !== "undefined" ) {
    mixpanel.track( "Checkout - Step back to Delivery" );
  }
  $( 'html,body' ).scrollTop( 0 );
}

Checkout.displayErrors = function( error ) {
  var errorMsg = "";
  $( initZ ).button( 'reset' );
  if ( error.error.type === "validation" ) {
    Checkout.goToDelivery();
    $.each( error.error.message, function( k, item ) {
      switch ( item.param ) {
        case "firstname":
          item.param = "firstlastname";
          break;
        case "lastname":
          item.param = "firstlastname";
          break;
      }
      $( 'input[name=\"' + item.param + '\"]' ).parent( "div" ).addClass( "has-error" );
      $( 'input[name=\"' + item.param + '\"]' ).after( "<p class='help-block'>" + item.error + "</p>" );

    } );
    errorMsg = "Fields highlighted in red are incorrect, please review your information and submit the order again.";
  } else if ( error.error.type === "internal_error" ) {
    errorMsg = error.error.message;
  } else if ( error.error.type === "bad_request" ) {
    errorMsg = error.error.message;
  } else {
    errorMsg = error.error.message;
  }

  $( initZ ).after( "<p class='formErrorNotification bg-danger'>" + errorMsg + "</p>" );

  // order.customer.email
  var email_log = "";
  if ( typeof order !== "undefined" ) {
    email_log = order.customer.email;
  }
  Rollbar.critical( "Chec.io: " + errorMsg + " - " + email_log );
}

//Load all states for current country
Checkout.shippingCountrySubdivisions = function( country_code, select ) {
  return CommercejsSpace.Services.localeListSubdivisions( country_code, function( subdivisions ) {
      var html;
      // Inject states to select form field
      html = '<option disabled="" selected="">State/Province</option>' + subdivisions.html;
      $( 'select[name="shipping[county_state]"]' ).html( html );
      if ( select ) {
        $( 'select[name="shipping[county_state]"]' ).find( 'option[value="' + select + '"]' ).prop( 'selected', true );
        return $( 'select[name="shipping[county_state]"]' ).parent().addClass( 'valid' );
      }
    },
    function( error ) {
      Rollbar.critical( "chec.io: " + error.message );
    } );
};
// Check if Zip is valid
Checkout.checkIfValidZip = function( zipcode ) {
  var zipSF = [ "94102", "94103", "94104", "94105", "94107", "94108", "94109", "94110",
    "94111", "94112", "94114", "94115", "94116", "94117", "94118", "94119", "94120", "94121",
    "94122", "94123", "94124", "94125", "94126", "94127", "94128", "94129", "94130", "94131",
    "94132", "94133", "94134", "94137", "94139", "94140", "94141", "94142", "94143", "94144",
    "94145", "94146", "94147", "94151", "94158", "94159", "94160", "94161", "94163", "94164",
    "94172", "94177"
  ];
  if ( zipcode === "" ) {
    return true;
  } else {
    return zipSF.includes( zipcode );
  }

}
