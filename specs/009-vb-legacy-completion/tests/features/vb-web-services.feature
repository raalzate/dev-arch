# DO NOT MODIFY SCENARIOS
# These .feature files define expected behavior derived from requirements.
# During implementation:
#   - Write step definitions to match these scenarios
#   - Fix code to pass tests, don't modify .feature files
#   - If requirements change, re-run /iikit-04-testify

@US-6 @P2
Feature: Legacy VB web services as API contracts
  As an architect
  I want ASMX and WCF operations written in VB to appear as endpoints of the API contract
  So that the existing interfaces of the legacy system are inventoried

  @TS-050 @FR-050 @FR-051 @FR-053 @SC-008 @acceptance
  Scenario: Exact endpoints of the synthetic web services corpus
    Given the synthetic VB project "SyntheticWebServices"
    When the project is analyzed
    Then the endpoints are exactly:
      | method | path                                     | component                              |
      | GET    | /OrderService.svc/orders/{id}            | LegacyShop.Services.OrderService       |
      | POST   | /CustomerWebService.asmx/GetCustomerCount | LegacyShop.Services.CustomerWebService |
      | POST   | /CustomerWebService.asmx/Ping            | LegacyShop.Services.CustomerWebService |
      | POST   | /OrderService.svc/CancelOrder            | LegacyShop.Services.OrderService       |
      | PUT    | /OrderService.svc/orders/{id}/status     | LegacyShop.Services.OrderService       |

  @TS-051 @FR-052 @acceptance
  Scenario: Parameters and response of a WebInvoke operation with path and query placeholders
    Given the synthetic VB project "SyntheticWebServices"
    When the project is analyzed
    Then the endpoint "PUT /OrderService.svc/orders/{id}/status" has the parameters:
      | name   | in    | type    | required |
      | id     | path  | String  | true     |
      | status | body  | String  | true     |
      | notify | query | Boolean | true     |
    And the endpoint "PUT /OrderService.svc/orders/{id}/status" has the response schema "Boolean"

  @TS-052 @FR-052 @acceptance
  Scenario: Optional parameters and Sub operations
    Given the synthetic VB project "SyntheticWebServices"
    When the project is analyzed
    Then the endpoint "POST /OrderService.svc/CancelOrder" has the parameters:
      | name    | in   | type    | required |
      | orderId | body | Integer | true     |
      | reason  | body | String  | false    |
    And the endpoint "POST /OrderService.svc/CancelOrder" has no response schema
    And the endpoint "POST /CustomerWebService.asmx/Ping" has no parameters
    And the endpoint "POST /CustomerWebService.asmx/Ping" has no response schema

  @TS-053 @FR-052 @acceptance
  Scenario: WebGet and ASMX parameters and responses
    Given the synthetic VB project "SyntheticWebServices"
    When the project is analyzed
    Then the endpoint "GET /OrderService.svc/orders/{id}" has the parameters:
      | name | in   | type   | required |
      | id   | path | String | true     |
    And the endpoint "GET /OrderService.svc/orders/{id}" has the response schema "OrderDto"
    And the endpoint "POST /CustomerWebService.asmx/GetCustomerCount" has the parameters:
      | name   | in   | type   | required |
      | region | body | String | true     |
    And the endpoint "POST /CustomerWebService.asmx/GetCustomerCount" has the response schema "Integer"

  @TS-054 @FR-050 @FR-051 @acceptance
  Scenario: Contracts without implementation, contracts on classes and qualified attributes
    Given a VB legacy project with the file "Services.vb":
      """
      Imports System.ServiceModel
      Imports System.Web.Services

      Namespace Sample
          <ServiceContract()> _
          Public Interface IPricing
              <OperationContract()> _
              Function Quote(ByVal sku As String) As Decimal
          End Interface

          <ServiceContract()> _
          Public Class Inventory
              <OperationContract()> _
              Public Function Count(ByVal sku As String) As Integer
                  Return 0
              End Function
          End Class

          Public Class Legacy
              Inherits WebService

              <System.Web.Services.WebMethodAttribute()> _
              Public Function Echo(ByVal text As String) As String
                  Return text
              End Function

              <WebMethod> Function Implicit() As Integer
                  Return 1
              End Function

              <WebMethod()> _
              Protected Function Internal() As Integer
                  Return 2
              End Function
          End Class
      End Namespace
      """
    When the project is analyzed
    Then the endpoints are exactly:
      | method | path                      | component         |
      | POST   | /IPricing.svc/Quote       | Sample.IPricing   |
      | POST   | /Inventory.svc/Count      | Sample.Inventory  |
      | POST   | /Legacy.asmx/Echo         | Sample.Legacy     |
      | POST   | /Legacy.asmx/Implicit     | Sample.Legacy     |

  @TS-055 @FR-050 @FR-051 @validation
  Scenario: A desktop project without web services has no endpoints
    Given the synthetic VB project "SyntheticDesktop"
    When the project is analyzed
    Then there are no endpoints
