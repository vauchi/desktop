# Page snapshot

```yaml
- main "Exchange" [ref=e4]:
  - banner [ref=e5]:
    - button "Go back to home" [ref=e6] [cursor=pointer]: Back
    - heading "Exchange" [level=1] [ref=e7]
  - region "Your QR Code" [ref=e8]:
    - heading "Your QR Code" [level=2] [ref=e9]
    - paragraph [ref=e10]: Show this code to exchange
    - generic [ref=e11]:
      - img "Your contact exchange QR code. Show this to someone to let them scan and add you as a contact." [ref=e12]
      - paragraph [ref=e13]: Test User
      - timer [ref=e14]:
        - generic [ref=e15]: "Missing: exchange.expires_in"
        - button "Refresh QR code" [ref=e16] [cursor=pointer]: ↻
    - generic [ref=e17]:
      - paragraph [ref=e18]: "Or share this data:"
      - generic [ref=e19]:
        - textbox [ref=e20]: vauchi://mock-exchange-data
        - button "Copy exchange data to clipboard" [ref=e21] [cursor=pointer]: Copy
  - region "Exchange" [ref=e22]:
    - heading "Exchange" [level=2] [ref=e23]
    - paragraph [ref=e24]: Paste the exchange data from another user
    - textbox "Exchange data input" [ref=e25]:
      - /placeholder: Paste exchange data here...
    - button "Complete the contact exchange" [ref=e26] [cursor=pointer]: Exchange
  - navigation "Main navigation" [ref=e27]:
    - button "Go to Home" [ref=e28] [cursor=pointer]: Home
    - button "Go to Contacts" [ref=e29] [cursor=pointer]: Contacts
    - button "Exchange (current page)" [ref=e30] [cursor=pointer]: Exchange
    - button "Go to Settings" [ref=e31] [cursor=pointer]: Settings
```