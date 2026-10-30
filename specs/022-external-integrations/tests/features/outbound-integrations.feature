# DO NOT MODIFY SCENARIOS
# These .feature files define expected behavior derived from requirements.
# During implementation:
#   - Write step definitions to match these scenarios
#   - Fix code to pass tests, don't modify .feature files
#   - If requirements change, re-run /iikit-04-testify

@US-1 @P1
Feature: Outbound integrations of VB legacy components
  As an architect
  I want each component that calls an external SOAP, WCF or REST service to declare it
  So that the modernization proposal knows the outbound integrations

  @TS-001 @FR-001 @FR-004 @acceptance
  Scenario: Service and Web References are recognized by folder and usage
    Given a VB legacy project with the file "Gateways.vb":
      """
      Namespace Sample
          Public Class OfacGateway
              Public Function Check(ByVal name As String) As Boolean
                  Dim client As New Ofac.OfacClient()
                  Return client.IsListed(name)
              End Function
          End Class

          Public Class HolidayGateway
              Public Function IsHoliday(ByVal day As Date) As Boolean
                  Dim service As New Holiday.HolidayService()
                  Return service.IsHoliday(day)
              End Function
          End Class

          Public Class Unrelated
              Public Sub Run()
              End Sub
          End Class
      End Namespace
      """
    And the project file "Service References/Ofac/Ofac.svcmap":
      """
      <ReferenceGroup xmlns="urn:schemas-microsoft-com:xml-wcfservicemap" />
      """
    And the project file "Web References/Holiday/Reference.map":
      """
      <DiscoveryClientResultsFile />
      """
    When the project is analyzed
    Then the component "Sample.OfacGateway" has the annotation "Integration:wcf:Ofac"
    And the component "Sample.OfacGateway" has exactly the external dependencies "service:Ofac"
    And the component "Sample.HolidayGateway" has the annotation "Integration:soap:Holiday"
    And the component "Sample.HolidayGateway" has exactly the external dependencies "service:Holiday"
    And the component "Sample.Unrelated" has no annotation starting with "Integration:"
    And the component "Sample.Unrelated" has exactly the external dependencies ""

  @TS-002 @FR-002 @acceptance
  Scenario: Hand-written WCF and SOAP clients
    Given a VB legacy project with the file "Clients.vb":
      """
      Namespace Sample
          Public Class PricingClient
              Inherits System.ServiceModel.ClientBase(Of IPricing)
          End Class

          Public Class LegacySoapClient
              Inherits System.Web.Services.Protocols.SoapHttpClientProtocol
          End Class
      End Namespace
      """
    When the project is analyzed
    Then the component "Sample.PricingClient" has the annotation "Integration:wcf:IPricing"
    And the component "Sample.PricingClient" has exactly the external dependencies "service:IPricing"
    And the component "Sample.LegacySoapClient" has the annotation "Integration:soap:LegacySoapClient"

  @TS-003 @FR-003 @FR-004 @FR-005 @acceptance
  Scenario: REST clients with a literal URL, a configuration key or a dynamic value
    Given a VB legacy project with the file "Rest.vb":
      """
      Namespace Sample
          Public Class RatesClient
              Public Sub Load(ByVal path As String)
                  Dim client As New RestClient("https://user:secret@api.example.invalid:8443/v1/rates?key=abc")
                  Dim request = System.Net.WebRequest.Create("http://rates.example.invalid/today")
                  Dim configured As New RestClient(ConfigurationManager.AppSettings("BisiBaseURL"))
                  Dim dynamic As New RestClient(path)
              End Sub
          End Class
      End Namespace
      """
    When the project is analyzed
    Then the component "Sample.RatesClient" has the annotation "Integration:rest:api.example.invalid"
    And the component "Sample.RatesClient" has the annotation "Integration:rest:rates.example.invalid"
    And the component "Sample.RatesClient" has the annotation "Integration:rest:BisiBaseURL"
    And the component "Sample.RatesClient" has the annotation "Integration:rest:dynamic"
    And the component "Sample.RatesClient" has exactly the external dependencies "http:BisiBaseURL, http:api.example.invalid, http:rates.example.invalid"
    And the serialized output does not contain "secret"
    And the serialized output does not contain "key=abc"
    And the analyzer reports exactly these outbound warnings:
      """
      Outbound URL is not a literal or a configuration key in Sample.RatesClient (Rest.vb:7)
      """

  @TS-004 @FR-010 @FR-005 @acceptance
  Scenario: Client endpoints of the configuration enrich the WCF integrations
    Given a VB legacy project with the file "OfacGateway.vb":
      """
      Namespace Sample
          Public Class OfacGateway
              Public Sub Check()
                  Dim client As New Ofac.OfacClient()
              End Sub
          End Class
      End Namespace
      """
    And the project file "Service References/Ofac/Ofac.svcmap":
      """
      <ReferenceGroup xmlns="urn:schemas-microsoft-com:xml-wcfservicemap" />
      """
    And the project file "app.config":
      """
      <?xml version="1.0" encoding="utf-8"?>
      <configuration>
        <system.serviceModel>
          <client>
            <endpoint address="net.tcp://svc:s3cret@ofac.example.invalid:8012/Ofac?x=1" binding="netTcpBinding" contract="Ofac.IOfacService" name="TcpEndpoint" />
            <endpoint address="http://other.example.invalid/Pricing.svc" binding="basicHttpBinding" contract="Pricing.IPricing" name="Http" />
          </client>
        </system.serviceModel>
      </configuration>
      """
    When the project is analyzed
    Then the component "Sample.OfacGateway" has the annotation "Integration:wcf:Ofac.IOfacService@ofac.example.invalid"
    And the component "Sample.OfacGateway" has no annotation starting with "Integration:wcf:Pricing"
    And the serialized output does not contain "s3cret"
    And the serialized output does not contain "8012"

  @TS-005 @FR-040 @FR-041 @SC-003 @acceptance
  Scenario Outline: Existing C# fixtures keep their golden output
    Given the C# fixture project "<fixture>"
    When the project is analyzed
    Then the serialized output, with the fixture root replaced by "<ROOT>", equals the golden file "<golden>"

    Examples:
      | fixture          | golden                       |
      | SampleProject    | SampleProject.golden.json    |
      | CodeIssuesSample | CodeIssuesSample.golden.json |
